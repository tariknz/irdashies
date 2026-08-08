import { describe, expect, it, vi } from 'vitest';
import type {
  ReferenceLapsSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { ReferenceLapRuntime } from './referenceLapRuntime';

const session = {
  WeekendInfo: {
    SeriesID: 7,
    TrackID: 9,
    SubSessionID: 11,
    TrackLength: '1 km',
  },
  DriverInfo: {
    PaceCarIdx: -1,
    Drivers: [{ CarIdx: 0, CarClassID: 12 }],
  },
} as Session;

const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

const telemetry = (pct: number, time: number) =>
  ({
    CarIdxLapDistPct: { value: [pct] },
    CarIdxOnPitRoad: { value: [false] },
    SessionTime: { value: [time] },
    SessionNum: { value: [1] },
  }) as unknown as Telemetry;

describe('ReferenceLapRuntime', () => {
  it('activates for subscribers that predate the runtime', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'reference-laps.snapshot');
    const runtime = new ReferenceLapRuntime(
      bus,
      createSessionLifecycle(),
      { markStart: vi.fn(), markEnd: vi.fn() },
      { load: () => null, save: vi.fn() }
    );
    runtime.onSession(session);
    expect(publish).toHaveBeenCalledWith(
      'reference-laps.snapshot',
      expect.objectContaining({ bestLaps: [], persistedLaps: [] })
    );
  });

  it('does not read or write live persistence during curated replay', () => {
    const load = vi.fn(() => null);
    const save = vi.fn();
    const bus = new ChannelBus();
    bus.subscribe(target, 'reference-laps.snapshot');
    const runtime = new ReferenceLapRuntime(
      bus,
      createSessionLifecycle(),
      { markStart: vi.fn(), markEnd: vi.fn() },
      { load, save },
      true
    );
    runtime.onSession(session);
    expect(load).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('publishes reset state and clears the cache on dispose', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'reference-laps.snapshot');
    const runtime = new ReferenceLapRuntime(
      bus,
      undefined,
      { markStart: vi.fn(), markEnd: vi.fn() },
      { load: () => null, save: vi.fn() }
    );
    runtime.onSession(session);
    runtime.dispose();
    expect(publish).toHaveBeenLastCalledWith(
      'reference-laps.snapshot',
      expect.objectContaining({ bestLaps: [] })
    );
    expect(clearSnapshot).toHaveBeenCalledWith('reference-laps.snapshot');
  });

  it('pauses without discarding best laps when subscribers return', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    bus.subscribe(target, 'reference-laps.snapshot');
    const runtime = new ReferenceLapRuntime(bus, undefined, metrics, {
      load: () => null,
      save: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry(0.001, 0));
    runtime.onFrame(telemetry(0.001, 0.01));
    for (let point = 1; point < 100; point += 1) {
      runtime.onFrame(telemetry((point + 0.1) / 100, point * 0.6));
    }
    runtime.onFrame(telemetry(0.001, 60));
    const lastSnapshot = () =>
      publish.mock.calls.at(-1)?.[1] as ReferenceLapsSnapshot;
    expect(lastSnapshot().bestLaps).toHaveLength(1);

    bus.unsubscribe(target.id, 'reference-laps.snapshot');
    const processingCalls = metrics.markStart.mock.calls.length;
    runtime.onFrame(telemetry(0.1, 61));
    expect(metrics.markStart).toHaveBeenCalledTimes(processingCalls);

    bus.subscribe({ ...target, id: 2 }, 'reference-laps.snapshot');
    expect(publish).toHaveBeenLastCalledWith(
      'reference-laps.snapshot',
      expect.objectContaining({ bestLaps: expect.any(Array) })
    );
    expect(lastSnapshot().bestLaps).toHaveLength(1);
  });

  it('discards an incomplete lap when processing demand reaches zero', () => {
    const bus = new ChannelBus();
    const save = vi.fn();
    const runtime = new ReferenceLapRuntime(
      bus,
      undefined,
      { markStart: vi.fn(), markEnd: vi.fn() },
      { load: () => null, save }
    );
    const release = runtime.acquireConsumer();
    runtime.onSession(session);
    runtime.onFrame(telemetry(0.001, 0));
    runtime.onFrame(telemetry(0.001, 0.01));
    for (let point = 1; point < 100; point += 1) {
      runtime.onFrame(telemetry((point + 0.1) / 100, point * 0.6));
    }

    release();
    runtime.acquireConsumer();
    runtime.onFrame(telemetry(0.001, 100));

    expect(save).not.toHaveBeenCalled();
  });
});
