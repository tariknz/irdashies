import { describe, expect, it, vi } from 'vitest';
import type {
  ReferenceLapsSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { RelativeGapRuntime } from './relativeGapRuntime';

const references: ReferenceLapsSnapshot = {
  bestLaps: [],
  persistedLaps: [],
  sessionNum: 1,
  version: 0,
};
const session = {
  DriverInfo: {
    DriverCarIdx: 0,
    Drivers: [
      { CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 100 },
      { CarIdx: 1, CarClassID: 1, CarClassEstLapTime: 100 },
    ],
  },
} as Session;
const telemetry = {
  CarIdxLapDistPct: { value: [0.2, 0.25] },
  CarIdxEstTime: { value: [20, 25] },
  CarIdxLap: { value: [4, 4] },
  CarIdxOnPitRoad: { value: [false, false] },
  SessionTime: { value: [1] },
  SessionNum: { value: [1] },
  CamCarIdx: { value: [0] },
} as unknown as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

describe('RelativeGapRuntime', () => {
  it('activates on demand and retains the reference-lap processor', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const release = vi.fn();
    const referenceLaps = {
      acquireConsumer: vi.fn(() => release),
      snapshot: () => references,
    };
    const runtime = new RelativeGapRuntime(
      bus,
      createSessionLifecycle(),
      { markStart: vi.fn(), markEnd: vi.fn() },
      referenceLaps
    );
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).not.toHaveBeenCalled();

    bus.subscribe(target, 'relative-gaps.snapshot');
    runtime.onFrame(telemetry);
    expect(referenceLaps.acquireConsumer).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenLastCalledWith(
      'relative-gaps.snapshot',
      expect.objectContaining({ deltas: [0, 5] })
    );

    bus.unsubscribe(target.id, 'relative-gaps.snapshot');
    expect(release).toHaveBeenCalledOnce();
  });

  it('activates when subscribers predate runtime replacement', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'relative-gaps.snapshot');
    const runtime = new RelativeGapRuntime(
      bus,
      undefined,
      { markStart: vi.fn(), markEnd: vi.fn() },
      { acquireConsumer: () => vi.fn(), snapshot: () => references }
    );
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledWith(
      'relative-gaps.snapshot',
      expect.objectContaining({ focusCarIdx: 0 })
    );
  });

  it('clears published state when disposed', () => {
    const bus = new ChannelBus();
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'relative-gaps.snapshot');
    const runtime = new RelativeGapRuntime(
      bus,
      undefined,
      { markStart: vi.fn(), markEnd: vi.fn() },
      { acquireConsumer: () => vi.fn(), snapshot: () => references }
    );
    runtime.dispose();
    expect(clearSnapshot).toHaveBeenLastCalledWith('relative-gaps.snapshot');
  });
});
