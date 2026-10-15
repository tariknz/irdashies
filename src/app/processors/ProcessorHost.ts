import type {
  ChannelName,
  ChannelPayloads,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBus';
import type { SessionLifecycle } from '../sessionLifecycle';
import type { TelemetryProcessor } from './TelemetryProcessor';
import logger from '../logger';

export type ProcessorChannel = Exclude<ChannelName, 'session.lifecycle'>;

/** Startup instrumentation is opt-in, so it costs nothing by default. */
const STARTUP_DEBUG = process.env.IRDASHIES_LOG_LEVEL === 'debug';

interface SnapshotShape {
  /** Log-safe summary. Never stringifies a 60-car telemetry frame. */
  description: string;
  /** True once any array field carries an entry. */
  populated: boolean;
  /** False for channels that hold no arrays, so they are never waited on. */
  hasArrays: boolean;
}

/**
 * Enough of a snapshot's shape to tell a populated payload from an empty one
 * in the log. A channel's first publish is often empty because the processor
 * has only just been activated by a subscriber, so the first *populated*
 * publish is the timestamp that says when data actually reached a widget.
 */
const inspectSnapshot = (snapshot: unknown): SnapshotShape => {
  if (snapshot === null || snapshot === undefined) {
    return { description: 'empty', populated: false, hasArrays: false };
  }
  if (Array.isArray(snapshot)) {
    return {
      description: `array(${snapshot.length})`,
      populated: snapshot.length > 0,
      hasArrays: true,
    };
  }
  if (typeof snapshot !== 'object') {
    return { description: typeof snapshot, populated: true, hasArrays: false };
  }
  const entries = Object.entries(snapshot as Record<string, unknown>);
  const arrays = entries.filter(([, value]) => Array.isArray(value));
  const longestArray = arrays.reduce(
    (longest, [, value]) => Math.max(longest, (value as unknown[]).length),
    0
  );
  return {
    description: `keys=${entries.length} longestArray=${longestArray}`,
    populated: longestArray > 0,
    hasArrays: arrays.length > 0,
  };
};

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
  /**
   * Keep processing frames while every subscribed window is hidden. Demand then
   * follows registered subscriptions instead of visible ones, so state built up
   * over a race (such as lap-time history) survives a minimised window. The bus
   * still gates delivery; the current snapshot is pushed when a window becomes
   * visible again. Off by default so a hidden window costs nothing.
   */
  readonly processWhileHidden?: boolean;
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
  tickSchedule: TickSchedule;
  lastPublishedToken?: unknown;
}

interface ProcessorHostOptions {
  bus: ChannelBus;
  lifecycle?: SessionLifecycle;
  metrics: ProcessorMetrics;
  definitions: readonly AnyProcessorDefinition[];
  aggregateReplay?: boolean;
  /** Frame time in seconds; tickRateHz intervals are measured against it. */
  frameClock?: (frame: Telemetry) => number | undefined;
  /**
   * Where processor failures are reported. Defaults to discarding them so this
   * module stays free of the main-process logger and can run in a browser;
   * every Electron composition point passes the real logger.
   */
  logError?: (message: string, error: unknown) => void;
}

/** iRacing's SessionTick counts simulation ticks, 60 per second. */
const IRACING_TICKS_PER_SECOND = 60;

const sessionTickOf = (frame: Telemetry): number | undefined => {
  const sessionTick = frame.SessionTick?.value?.[0];
  return typeof sessionTick === 'number' && Number.isFinite(sessionTick)
    ? sessionTick
    : undefined;
};

/**
 * The default frame clock: iRacing's SessionTick in seconds. SessionTick keeps
 * advancing in a paused replay, where SessionTime stops (#706). Read as raw
 * ticks, consecutive frames are 1 apart, longer than any 1 / tickRateHz
 * interval, so nothing would be rate limited.
 */
export const iracingFrameClock = (frame: Telemetry): number | undefined => {
  const ticks = sessionTickOf(frame);
  return ticks === undefined ? undefined : ticks / IRACING_TICKS_PER_SECOND;
};

/** Frame clock for the LMU mapping, which fills SessionTick with seconds. */
export const sessionSecondsFrameClock = sessionTickOf;

/** When a rate-limited processor last saw a frame and is next due. */
export interface TickSchedule {
  lastFrameTime?: number;
  lastRunAt?: number;
  nextDueAt?: number;
}

/**
 * Whether a processor declared at tickRateHz should run on a frame at
 * frameTime (seconds), advancing its schedule when it does. Runs are spaced
 * 1 / tickRateHz from the previous due time rather than from the frame that
 * ran, so a poll rate that doesn't divide the tick rate still averages the
 * declared rate instead of rounding down to whole frames (25 Hz on 60 Hz
 * frames would otherwise run every third frame, 20 Hz). Event processors,
 * frames without a clock and frames on a frozen clock (a paused replay whose
 * camera still changes) always run. A seek back or a gap of more than one
 * interval behind the due time restarts the schedule instead of bursting to
 * catch up; a lag of less than one interval keeps the carried deadline, or a
 * poll that alternates 33 and 50 ms would run a 25 Hz processor at 12 Hz.
 */
export const takeTick = (
  schedule: TickSchedule,
  tickRateHz: number | 'event',
  frameTime: number | undefined
): boolean => {
  if (tickRateHz === 'event' || frameTime === undefined) return true;
  // A repeated frame time means the clock is frozen (a paused session whose
  // camera can still change), even when the first frame at that time was
  // skipped. Frozen frames always run, as RelativeGap's paused camera
  // change needs.
  if (
    frameTime === schedule.lastRunAt ||
    frameTime === schedule.lastFrameTime
  ) {
    return true;
  }
  const previous = schedule.lastFrameTime;
  schedule.lastFrameTime = frameTime;
  const seekBack = previous !== undefined && frameTime < previous;
  if (
    !seekBack &&
    schedule.nextDueAt !== undefined &&
    frameTime < schedule.nextDueAt - 1e-6
  ) {
    return false;
  }
  const interval = 1 / tickRateHz;
  const next =
    schedule.nextDueAt === undefined
      ? undefined
      : schedule.nextDueAt + interval;
  schedule.nextDueAt =
    seekBack || next === undefined || next + interval <= frameTime
      ? frameTime + interval
      : next;
  schedule.lastRunAt = frameTime;
  return true;
};

const snapshotToken = (snapshot: unknown): unknown => {
  if (typeof snapshot !== 'object' || snapshot === null) return snapshot;
  const version = (snapshot as { version?: unknown }).version;
  return typeof version === 'number' ? version : snapshot;
};

const hasDirectDemand = (
  definition: AnyProcessorDefinition,
  activeCount: number,
  registeredCount: number
): boolean =>
  definition.processWhileHidden ? registeredCount > 0 : activeCount > 0;

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
  /** Last visible subscriber count per channel, to spot a window being shown. */
  private readonly activeCounts = new Map<ProcessorChannel, number>();
  private readonly reportedFailures = new Set<string>();
  /** Channels whose first publish has already been logged. Debug aid only. */
  private readonly firstPublishLogged = new Set<ProcessorChannel>();
  /** Channels whose first populated publish has been logged. Debug aid only. */
  private readonly firstPopulatedPublishLogged = new Set<ProcessorChannel>();
  private readonly disconnects: (() => void)[] = [];
  private latestSession?: Session;
  private sourceReplay?: boolean;
  private disposed = false;

  constructor(options: ProcessorHostOptions) {
    this.bus = options.bus;
    this.metrics = options.metrics;
    this.aggregateReplay = options.aggregateReplay ?? false;
    this.frameClock = options.frameClock ?? iracingFrameClock;
    this.logError = options.logError ?? (() => undefined);

    const definitions = this.sortDefinitions(options.definitions);
    this.states = definitions.map((definition) => ({
      definition,
      tickSchedule: {},
    }));
    for (const state of this.states) {
      const channel = state.definition.channel;
      this.statesByChannel.set(channel, state);
      const activeCount = this.bus.subscriberCount(channel);
      this.activeCounts.set(channel, activeCount);
      const registeredCount = this.bus.registeredSubscriberCount(channel);
      if (hasDirectDemand(state.definition, activeCount, registeredCount)) {
        this.directDemand.add(channel);
      }
    }

    this.disconnects.push(
      this.bus.onSubscriberCountChanged(
        (channel, activeCount, registeredCount) => {
          const processorChannel = channel as ProcessorChannel;
          const state = this.statesByChannel.get(processorChannel);
          if (!state) return;
          const wasVisible = (this.activeCounts.get(processorChannel) ?? 0) > 0;
          this.activeCounts.set(processorChannel, activeCount);
          if (hasDirectDemand(state.definition, activeCount, registeredCount)) {
            this.directDemand.add(processorChannel);
          } else {
            this.directDemand.delete(processorChannel);
          }
          this.reconcileDemand();
          // Seed the first visible window. For a processWhileHidden processor
          // this is the only way a re-shown window sees what it missed.
          if (!wasVisible && activeCount > 0 && state.processor) {
            this.publishIfChanged(state, true);
          }
        }
      )
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
        !takeTick(state.tickSchedule, processor.tickRateHz, frameTime)
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
    this.activeCounts.clear();
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
    state.tickSchedule = {};
  }

  private deactivate(state: RuntimeState): void {
    state.processor = undefined;
    state.tickSchedule = {};
    state.lastPublishedToken = undefined;
    // Log the first publishes again after a reconnect, so a mid-run rejoin is
    // as traceable as the first startup.
    this.firstPublishLogged.delete(state.definition.channel);
    this.firstPopulatedPublishLogged.delete(state.definition.channel);
    this.bus.clearSnapshot(state.definition.channel);
  }

  private suspend(state: RuntimeState): void {
    const pausable = state.processor as
      (TelemetryProcessor<unknown> & { pause?: () => void }) | undefined;
    this.runSafely(state, 'suspend', () => pausable?.pause?.());
    state.tickSchedule = {};
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
      state.tickSchedule = {};
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
    if (succeeded) {
      state.lastPublishedToken = token;
      if (STARTUP_DEBUG) {
        this.logFirstPublishes(state.definition.channel, snapshot);
      }
    }
  }

  /**
   * Debug aid for diagnosing a slow or empty startup. Logs the first publish on
   * a channel, and separately the first publish that actually carries data.
   * Channels holding no array fields only ever log the first line.
   */
  private logFirstPublishes(
    channel: ProcessorChannel,
    snapshot: ChannelPayloads[ProcessorChannel]
  ): void {
    const needsFirst = !this.firstPublishLogged.has(channel);
    const needsPopulated = !this.firstPopulatedPublishLogged.has(channel);
    if (!needsFirst && !needsPopulated) return;

    const shape = inspectSnapshot(snapshot);
    if (needsFirst) {
      this.firstPublishLogged.add(channel);
      logger.debug(
        `[ProcessorHost] first publish on ${channel}: ${shape.description}`
      );
    }
    if (!needsPopulated) return;
    // A channel with no array fields has nothing to fill, so mark it done and
    // stop inspecting its every publish.
    if (!shape.hasArrays) {
      this.firstPopulatedPublishLogged.add(channel);
      return;
    }
    if (shape.populated) {
      this.firstPopulatedPublishLogged.add(channel);
      logger.debug(
        `[ProcessorHost] first populated publish on ${channel}: ${shape.description}`
      );
    }
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
