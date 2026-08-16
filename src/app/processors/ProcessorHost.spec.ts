import { describe, expect, it, vi, type Mock } from 'vitest';
import type {
  ChannelPayloads,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import type { TelemetryProcessor } from './TelemetryProcessor';
import {
  ProcessorHost,
  type ProcessorChannel,
  type ProcessorDefinition,
} from './ProcessorHost';

const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

const target = (id: number, isVisible: () => boolean = () => true) => ({
  id,
  isDestroyed: () => false,
  isVisible,
  send: vi.fn(),
});

interface FakeProcessor<K extends ProcessorChannel> extends TelemetryProcessor<
  ChannelPayloads[K],
  K
> {
  init: Mock<(session: Session) => void>;
  onFrame: Mock<(frame: Telemetry) => void>;
  onLifecycle: Mock<(event: SessionLifecycleEvent) => void>;
}

const fakeProcessor = <K extends ProcessorChannel>(
  channel: K,
  tickRateHz: number | 'event',
  update?: (state: { version: number }) => void
): FakeProcessor<K> => {
  const state = { version: 0 };
  return {
    channel,
    tickRateHz,
    init: vi.fn<(session: Session) => void>(),
    onFrame: vi.fn<(frame: Telemetry) => void>(() => update?.(state)),
    onLifecycle: vi.fn<(event: SessionLifecycleEvent) => void>((event) => {
      if (event.type !== 'enter') state.version += 1;
    }),
    snapshot: () =>
      ({ version: state.version }) as unknown as ChannelPayloads[K],
  };
};

const definition = <K extends ProcessorChannel>(
  channel: K,
  create: () => TelemetryProcessor<ChannelPayloads[K], K>,
  dependencies?: readonly ProcessorChannel[],
  retainWhenInactive = false
): ProcessorDefinition<K> => ({
  channel,
  dependencies,
  retainWhenInactive,
  metricsPrefix: channel,
  create,
});

describe('ProcessorHost', () => {
  it('enforces numeric processor cadence using an injected frame clock', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(1), 'standings.snapshot');
    const processor = fakeProcessor('standings.snapshot', 5, (state) => {
      state.version += 1;
    });
    let now = 0;
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      frameClock: () => now,
      definitions: [definition('standings.snapshot', () => processor)],
    });
    const frame = {} as Telemetry;

    for (const time of [0, 0.1, 0.199, 0.2, 0.4]) {
      now = time;
      host.onFrame(frame);
    }

    expect(processor.onFrame).toHaveBeenCalledTimes(3);
  });

  it('checks event processors every frame and publishes only on a signal', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target(2), 'radio.snapshot');
    let frameCount = 0;
    const processor = fakeProcessor('radio.snapshot', 'event', (state) => {
      frameCount += 1;
      if (frameCount === 2) state.version += 1;
    });
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      definitions: [definition('radio.snapshot', () => processor)],
    });

    host.onFrame({} as Telemetry);
    host.onFrame({} as Telemetry);
    host.onFrame({} as Telemetry);

    expect(processor.onFrame).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('isolates processor failures and balances performance sections', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(3), 'radio.snapshot');
    bus.subscribe(target(4), 'sector-timing.snapshot');
    const failing = fakeProcessor('radio.snapshot', 'event');
    failing.onFrame.mockImplementation(() => {
      throw new Error('broken processor');
    });
    const healthy = fakeProcessor(
      'sector-timing.snapshot',
      'event',
      (state) => {
        state.version += 1;
      }
    );
    const performance = metrics();
    const logError = vi.fn();
    const host = new ProcessorHost({
      bus,
      metrics: performance,
      logError,
      definitions: [
        definition('radio.snapshot', () => failing),
        definition('sector-timing.snapshot', () => healthy),
      ],
    });

    host.onFrame({} as Telemetry);
    host.onFrame({} as Telemetry);

    expect(healthy.onFrame).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(performance.markEnd).toHaveBeenCalledWith(
      'radio.snapshotProcessing'
    );

    failing.onLifecycle.mockImplementation(() => {
      throw new Error('broken disposal');
    });
    host.dispose();
    expect(healthy.onLifecycle).toHaveBeenCalledWith({ type: 'disconnect' });
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it('isolates snapshot failures from later processors', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(10), 'radio.snapshot');
    bus.subscribe(target(11), 'sector-timing.snapshot');
    const publish = vi.spyOn(bus, 'publish');
    let failSnapshot = false;
    const failing = fakeProcessor('radio.snapshot', 'event', (state) => {
      state.version += 1;
      failSnapshot = true;
    });
    const initialSnapshot = failing.snapshot;
    failing.snapshot = vi.fn(() => {
      if (failSnapshot) throw new Error('broken snapshot');
      return initialSnapshot();
    });
    const healthy = fakeProcessor(
      'sector-timing.snapshot',
      'event',
      (state) => {
        state.version += 1;
      }
    );
    const logError = vi.fn();
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      logError,
      definitions: [
        definition('radio.snapshot', () => failing),
        definition('sector-timing.snapshot', () => healthy),
      ],
    });

    host.onFrame({} as Telemetry);

    expect(healthy.onFrame).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      'sector-timing.snapshot',
      expect.any(Object)
    );
    expect(logError).toHaveBeenCalledWith(
      '[ProcessorHost] radio.snapshot snapshot failed',
      expect.any(Error)
    );
  });

  it('creates processors only for visible demand and tears them down when hidden', () => {
    const bus = new ChannelBus();
    let visible = false;
    const renderer = target(5, () => visible);
    bus.subscribe(renderer, 'track-state.snapshot');
    const processors: FakeProcessor<'track-state.snapshot'>[] = [];
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      definitions: [
        definition('track-state.snapshot', () => {
          const processor = fakeProcessor('track-state.snapshot', 25);
          processors.push(processor);
          return processor;
        }),
      ],
    });

    host.onFrame({} as Telemetry);
    expect(processors).toHaveLength(0);

    visible = true;
    bus.rendererBecameVisible(renderer.id);
    host.onFrame({} as Telemetry);
    expect(processors).toHaveLength(1);
    expect(processors[0].onFrame).toHaveBeenCalledOnce();

    visible = false;
    bus.rendererBecameHidden(renderer.id);
    host.onFrame({} as Telemetry);
    expect(processors[0].onFrame).toHaveBeenCalledOnce();

    visible = true;
    bus.rendererBecameVisible(renderer.id);
    expect(processors).toHaveLength(2);
  });

  it('activates dependencies before their consumers', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(6), 'relative-gaps.snapshot');
    const order: string[] = [];
    const reference = definition('reference-laps.snapshot', () => {
      order.push('reference');
      return fakeProcessor('reference-laps.snapshot', 'event');
    });
    const relative: ProcessorDefinition<'relative-gaps.snapshot'> = {
      channel: 'relative-gaps.snapshot',
      dependencies: ['reference-laps.snapshot'],
      metricsPrefix: 'relativeGap',
      create: (context) => {
        order.push('relative');
        expect(context.snapshot('reference-laps.snapshot')).toBeDefined();
        return fakeProcessor('relative-gaps.snapshot', 5);
      },
    };

    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      definitions: [relative, reference],
    });

    expect(order).toEqual(['reference', 'relative']);
    expect(host.snapshot('reference-laps.snapshot')).toBeDefined();

    bus.unsubscribe(6, 'relative-gaps.snapshot');
    expect(host.snapshot('reference-laps.snapshot')).toBeUndefined();
    expect(host.snapshot('relative-gaps.snapshot')).toBeUndefined();
  });

  it('seeds a cold late subscriber from the latest session', () => {
    const bus = new ChannelBus();
    const processor = fakeProcessor('reference-laps.snapshot', 'event');
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      definitions: [definition('reference-laps.snapshot', () => processor)],
    });
    host.onSession({} as Session);
    const renderer = target(9);

    bus.subscribe(renderer, 'reference-laps.snapshot');

    expect(processor.init).toHaveBeenCalledOnce();
    expect(renderer.send).toHaveBeenCalledOnce();
  });

  it('pauses retained processor state without discarding it', () => {
    const bus = new ChannelBus();
    const firstRenderer = target(12);
    bus.subscribe(firstRenderer, 'reference-laps.snapshot');
    const processor = fakeProcessor('reference-laps.snapshot', 'event');
    const pause = vi.fn();
    Object.assign(processor, { pause });
    const create = vi.fn(() => processor);
    const host = new ProcessorHost({
      bus,
      metrics: metrics(),
      definitions: [
        definition('reference-laps.snapshot', create, undefined, true),
      ],
    });
    host.onFrame({} as Telemetry);

    bus.unsubscribe(firstRenderer.id, 'reference-laps.snapshot');
    host.onFrame({} as Telemetry);
    const secondRenderer = target(13);
    bus.subscribe(secondRenderer, 'reference-laps.snapshot');

    expect(pause).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(secondRenderer.send).toHaveBeenCalledOnce();
  });

  it('owns session and replay lifecycle dispatch and disposes once', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(7), 'standings.snapshot');
    const lifecycle = createSessionLifecycle();
    const processor = fakeProcessor('standings.snapshot', 5);
    const setSourceReplay = vi.fn<(replay: boolean) => void>();
    Object.assign(processor, { setSourceReplay });
    const host = new ProcessorHost({
      bus,
      lifecycle,
      metrics: metrics(),
      aggregateReplay: true,
      definitions: [definition('standings.snapshot', () => processor)],
    });
    const session = {} as Session;

    host.onSession(session);
    lifecycle._onEnter({ replay: true });
    host.dispose();
    host.dispose();

    expect(processor.init).toHaveBeenCalledWith(session);
    expect(processor.onLifecycle).toHaveBeenCalledWith({
      type: 'enter',
      replay: false,
    });
    expect(setSourceReplay).toHaveBeenCalledWith(true);
    expect(processor.onLifecycle).toHaveBeenCalledTimes(2);
  });

  it('continues processing when performance instrumentation fails', () => {
    const bus = new ChannelBus();
    bus.subscribe(target(8), 'radio.snapshot');
    const processor = fakeProcessor('radio.snapshot', 'event');
    const logError = vi.fn();
    const host = new ProcessorHost({
      bus,
      logError,
      metrics: {
        markStart: vi.fn(() => {
          throw new Error('metrics unavailable');
        }),
        markEnd: vi.fn(),
      },
      definitions: [definition('radio.snapshot', () => processor)],
    });

    host.onFrame({} as Telemetry);

    expect(processor.onFrame).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledOnce();
  });
});
