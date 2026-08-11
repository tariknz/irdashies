import type {
  ChannelName,
  ChannelPayloads,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import logger from '../logger';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import type { TelemetryProcessor } from './TelemetryProcessor';

export type ProcessorChannel = Exclude<ChannelName, 'session.lifecycle'>;

export interface ProcessorMetrics {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export interface ProcessorFactoryContext {
  readonly aggregateReplay: boolean;
  readonly sourceReplay: boolean;
  snapshot<K extends ProcessorChannel>(
    channel: K
  ): ChannelPayloads[K] | undefined;
}

export interface ProcessorDefinition<K extends ProcessorChannel> {
  readonly channel: K;
  readonly dependencies?: readonly ProcessorChannel[];
  readonly retainWhenInactive?: boolean;
  readonly metricsPrefix: string;
  create(
    context: ProcessorFactoryContext
  ): TelemetryProcessor<ChannelPayloads[K], K>;
}

export type AnyProcessorDefinition = {
  [K in ProcessorChannel]: ProcessorDefinition<K>;
}[ProcessorChannel];

interface RuntimeState {
  readonly definition: AnyProcessorDefinition;
  processor?: TelemetryProcessor<
    ChannelPayloads[ProcessorChannel],
    ProcessorChannel
  >;
  lastProcessedAt?: number;
  lastPublishedToken?: unknown;
}

interface ProcessorHostOptions {
  bus: ChannelBus;
  lifecycle?: SessionLifecycle;
  metrics: ProcessorMetrics;
  definitions: readonly AnyProcessorDefinition[];
  aggregateReplay?: boolean;
  frameClock?: (frame: Telemetry) => number | undefined;
  logError?: (message: string, error: unknown) => void;
}

const defaultFrameClock = (frame: Telemetry): number | undefined => {
  const value = frame.SessionTime?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const snapshotToken = (snapshot: unknown): unknown => {
  if (typeof snapshot !== 'object' || snapshot === null) return snapshot;
  const version = (snapshot as { version?: unknown }).version;
  return typeof version === 'number' ? version : snapshot;
};

export class ProcessorHost {
  private readonly bus: ChannelBus;
  private readonly metrics: ProcessorMetrics;
  private readonly aggregateReplay: boolean;
  private readonly frameClock: (frame: Telemetry) => number | undefined;
  private readonly logError: (message: string, error: unknown) => void;
  private readonly states: readonly RuntimeState[];
  private readonly statesByChannel = new Map<ProcessorChannel, RuntimeState>();
  private readonly directDemand = new Set<ProcessorChannel>();
  private activeDemand = new Set<ProcessorChannel>();
  private readonly reportedFailures = new Set<string>();
  private readonly disconnects: (() => void)[] = [];
  private latestSession?: Session;
  private sourceReplay?: boolean;
  private disposed = false;

  constructor(options: ProcessorHostOptions) {
    this.bus = options.bus;
    this.metrics = options.metrics;
    this.aggregateReplay = options.aggregateReplay ?? false;
    this.frameClock = options.frameClock ?? defaultFrameClock;
    this.logError =
      options.logError ?? ((message, error) => logger.error(message, error));

    const definitions = this.sortDefinitions(options.definitions);
    this.states = definitions.map((definition) => ({ definition }));
    for (const state of this.states) {
      this.statesByChannel.set(state.definition.channel, state);
      if (this.bus.subscriberCount(state.definition.channel) > 0) {
        this.directDemand.add(state.definition.channel);
      }
    }

    this.disconnects.push(
      this.bus.onSubscriberCountChanged((channel, count) => {
        if (!this.statesByChannel.has(channel as ProcessorChannel)) return;
        const processorChannel = channel as ProcessorChannel;
        const hadDirectDemand = this.directDemand.has(processorChannel);
        if (count > 0) this.directDemand.add(processorChannel);
        else this.directDemand.delete(processorChannel);
        this.reconcileDemand();
        if (!hadDirectDemand && count > 0) {
          const state = this.statesByChannel.get(processorChannel);
          if (state?.processor) this.publishIfChanged(state, true);
        }
      })
    );

    if (options.lifecycle) {
      this.disconnects.push(
        options.lifecycle.onEnter(({ replay }) => {
          this.sourceReplay = replay;
          this.dispatchLifecycle({
            type: 'enter',
            replay: replay && !this.aggregateReplay,
          });
        }),
        options.lifecycle.onSessionNumChange(() =>
          this.dispatchLifecycle({ type: 'sessionNumChange' })
        ),
        options.lifecycle.onDisconnect(() => {
          this.dispatchLifecycle({ type: 'disconnect' });
          this.latestSession = undefined;
          this.sourceReplay = undefined;
        })
      );
    }

    this.reconcileDemand();
    for (const channel of this.directDemand) {
      const state = this.statesByChannel.get(channel);
      if (state?.processor) this.publishIfChanged(state, true);
    }
  }

  onSession(session: Session): void {
    if (this.disposed) return;
    this.latestSession = session;
    for (const state of this.states) {
      if (!state.processor) continue;
      const succeeded = this.runSafely(state, 'init', () =>
        state.processor?.init(session)
      );
      if (succeeded) this.publishIfChanged(state);
    }
  }

  onFrame(frame: Telemetry): void {
    if (this.disposed) return;
    const frameTime = this.frameClock(frame);
    for (const state of this.states) {
      const processor = state.processor;
      if (
        !processor ||
        !this.activeDemand.has(state.definition.channel) ||
        !this.isDue(state, processor.tickRateHz, frameTime)
      ) {
        continue;
      }
      const succeeded = this.runSafely(
        state,
        'processing',
        () => processor.onFrame(frame),
        'Processing'
      );
      if (succeeded) this.publishIfChanged(state);
    }
  }

  snapshot<K extends ProcessorChannel>(
    channel: K
  ): ChannelPayloads[K] | undefined {
    const processor = this.statesByChannel.get(channel)?.processor;
    return processor?.snapshot() as ChannelPayloads[K] | undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const state of [...this.states].reverse()) {
      if (state.processor) {
        this.runSafely(state, 'dispose', () =>
          state.processor?.onLifecycle({ type: 'disconnect' })
        );
        this.publishIfChanged(state, true);
      }
      this.deactivate(state);
    }
    for (const disconnect of this.disconnects) disconnect();
    this.disconnects.length = 0;
    this.directDemand.clear();
    this.activeDemand.clear();
    this.latestSession = undefined;
    this.sourceReplay = undefined;
  }

  private reconcileDemand(): void {
    if (this.disposed) return;
    const desired = new Set<ProcessorChannel>();
    const include = (channel: ProcessorChannel): void => {
      if (desired.has(channel)) return;
      desired.add(channel);
      const state = this.statesByChannel.get(channel);
      for (const dependency of state?.definition.dependencies ?? []) {
        include(dependency);
      }
    };
    for (const channel of this.directDemand) include(channel);
    this.activeDemand = desired;

    for (const state of [...this.states].reverse()) {
      if (state.processor && !desired.has(state.definition.channel)) {
        if (state.definition.retainWhenInactive) this.suspend(state);
        else this.deactivate(state);
      }
    }
    for (const state of this.states) {
      if (!state.processor && desired.has(state.definition.channel)) {
        this.activate(state);
      }
    }
  }

  private activate(state: RuntimeState): void {
    this.bus.clearSnapshot(state.definition.channel);
    const succeeded = this.runSafely(state, 'activation', () => {
      const processor = state.definition.create({
        aggregateReplay: this.aggregateReplay,
        sourceReplay: this.sourceReplay ?? false,
        snapshot: (channel) => this.snapshot(channel),
      }) as TelemetryProcessor<
        ChannelPayloads[ProcessorChannel],
        ProcessorChannel
      >;
      state.processor = processor;
      if (processor.channel !== state.definition.channel) {
        throw new Error(
          `Processor channel mismatch: expected ${state.definition.channel}, received ${processor.channel}`
        );
      }
      if (this.latestSession) processor.init(this.latestSession);
      if (this.sourceReplay !== undefined) {
        this.setReplaySource(processor, this.sourceReplay);
        processor.onLifecycle({
          type: 'enter',
          replay: this.sourceReplay && !this.aggregateReplay,
        });
      }
      state.lastPublishedToken = snapshotToken(processor.snapshot());
    });
    if (!succeeded) state.processor = undefined;
    state.lastProcessedAt = undefined;
  }

  private deactivate(state: RuntimeState): void {
    state.processor = undefined;
    state.lastProcessedAt = undefined;
    state.lastPublishedToken = undefined;
    this.bus.clearSnapshot(state.definition.channel);
  }

  private suspend(state: RuntimeState): void {
    const pausable = state.processor as
      (TelemetryProcessor<unknown> & { pause?: () => void }) | undefined;
    this.runSafely(state, 'suspend', () => pausable?.pause?.());
    state.lastProcessedAt = undefined;
    state.lastPublishedToken = undefined;
    this.bus.clearSnapshot(state.definition.channel);
  }

  private dispatchLifecycle(event: SessionLifecycleEvent): void {
    if (this.disposed) return;
    for (const state of this.states) {
      const processor = state.processor;
      if (!processor) {
        this.bus.clearSnapshot(state.definition.channel);
        continue;
      }
      if (event.type === 'enter' && this.sourceReplay !== undefined) {
        this.setReplaySource(processor, this.sourceReplay);
      }
      const succeeded = this.runSafely(state, 'lifecycle', () =>
        processor.onLifecycle(event)
      );
      state.lastProcessedAt = undefined;
      if (succeeded) this.publishIfChanged(state);
    }
  }

  private publishIfChanged(state: RuntimeState, force = false): void {
    const processor = state.processor;
    if (!processor || !this.directDemand.has(state.definition.channel)) return;
    let snapshot: ChannelPayloads[ProcessorChannel] | undefined;
    const snapshotSucceeded = this.runSafely(state, 'snapshot', () => {
      snapshot = processor.snapshot();
    });
    if (!snapshotSucceeded || snapshot === undefined) return;
    const token = snapshotToken(snapshot);
    if (!force && token === state.lastPublishedToken) return;
    const succeeded = this.runSafely(
      state,
      'publication',
      () => this.bus.publish(state.definition.channel, snapshot),
      'Publication'
    );
    if (succeeded) state.lastPublishedToken = token;
  }

  private isDue(
    state: RuntimeState,
    tickRateHz: number | 'event',
    frameTime: number | undefined
  ): boolean {
    if (tickRateHz === 'event' || frameTime === undefined) return true;
    const previous = state.lastProcessedAt;
    const interval = 1 / tickRateHz;
    if (
      previous !== undefined &&
      frameTime >= previous &&
      frameTime - previous < interval - 1e-6
    ) {
      return false;
    }
    state.lastProcessedAt = frameTime;
    return true;
  }

  private runSafely(
    state: RuntimeState,
    phase: string,
    operation: () => void,
    metricSuffix?: 'Processing' | 'Publication'
  ): boolean {
    const label = metricSuffix
      ? `${state.definition.metricsPrefix}${metricSuffix}`
      : undefined;
    const failureKey = `${state.definition.channel}:${phase}`;
    if (label) this.recordMetric(state, label, 'start');
    try {
      operation();
      this.reportedFailures.delete(failureKey);
      return true;
    } catch (error) {
      if (!this.reportedFailures.has(failureKey)) {
        this.reportedFailures.add(failureKey);
        this.logError(
          `[ProcessorHost] ${state.definition.channel} ${phase} failed`,
          error
        );
      }
      return false;
    } finally {
      if (label) this.recordMetric(state, label, 'end');
    }
  }

  private recordMetric(
    state: RuntimeState,
    label: string,
    operation: 'start' | 'end'
  ): void {
    try {
      if (operation === 'start') this.metrics.markStart(label);
      else this.metrics.markEnd(label);
    } catch (error) {
      const failureKey = `${state.definition.channel}:metrics:${operation}`;
      if (this.reportedFailures.has(failureKey)) return;
      this.reportedFailures.add(failureKey);
      this.logError(
        `[ProcessorHost] ${state.definition.channel} metrics failed`,
        error
      );
    }
  }

  private setReplaySource(
    processor: TelemetryProcessor<unknown>,
    replay: boolean
  ): void {
    const replayAware = processor as TelemetryProcessor<unknown> & {
      setSourceReplay?: (sourceReplay: boolean) => void;
    };
    replayAware.setSourceReplay?.(replay);
  }

  private sortDefinitions(
    definitions: readonly AnyProcessorDefinition[]
  ): readonly AnyProcessorDefinition[] {
    const byChannel = new Map<ProcessorChannel, AnyProcessorDefinition>();
    for (const definition of definitions) {
      if (byChannel.has(definition.channel)) {
        throw new Error(`Duplicate processor channel: ${definition.channel}`);
      }
      byChannel.set(definition.channel, definition);
    }

    const visiting = new Set<ProcessorChannel>();
    const visited = new Set<ProcessorChannel>();
    const sorted: AnyProcessorDefinition[] = [];
    const visit = (channel: ProcessorChannel): void => {
      if (visited.has(channel)) return;
      if (visiting.has(channel)) {
        throw new Error(`Processor dependency cycle at ${channel}`);
      }
      const definition = byChannel.get(channel);
      if (!definition)
        throw new Error(`Unknown processor dependency: ${channel}`);
      visiting.add(channel);
      for (const dependency of definition.dependencies ?? []) visit(dependency);
      visiting.delete(channel);
      visited.add(channel);
      sorted.push(definition);
    };
    for (const definition of definitions) visit(definition.channel);
    return sorted;
  }
}
