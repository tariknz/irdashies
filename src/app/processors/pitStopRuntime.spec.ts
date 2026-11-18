import { describe, expect, it, vi } from 'vitest';
import type { PitStopRecord, Session, Telemetry } from '@irdashies/types';
import { TrackLocation } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { PitStopRuntime, type PitStopPersistence } from './pitStopRuntime';

const session = (subSessionId: number): Session =>
  ({
    WeekendInfo: { SubSessionID: subSessionId },
    DriverInfo: { Drivers: [{ CarIdx: 0, UserID: 11, UserName: 'A' }] },
  }) as unknown as Session;

const frame = (sessionTime: number): Telemetry =>
  ({
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [0] },
    CarIdxTrackSurface: { value: [TrackLocation.OnTrack] },
    CarIdxOnPitRoad: { value: [false] },
  }) as unknown as Telemetry;

const savedStop: PitStopRecord = {
  id: 1,
  carIdx: 0,
  kind: 'pit',
  lap: 4,
  entryTime: 50,
  exitTime: 90,
  stallTime: 60,
  stallSeconds: 25,
  stallEnteredAt: null,
  driverIdIn: 11,
  driverNameIn: 'A',
  driverIdOut: 11,
  driverNameOut: 'A',
  classPositionIn: 1,
  classPositionOut: 1,
  compoundIn: 0,
  compoundOut: 0,
  fastRepairs: 0,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = () => {
  const loads = new Map<number, (stops: PitStopRecord[] | null) => void>();
  const persistence = {
    load: vi.fn<PitStopPersistence['load']>(
      (key) => new Promise((resolve) => loads.set(key.subSessionId, resolve))
    ),
    save: vi.fn<PitStopPersistence['save']>(),
  };
  const bus = new ChannelBus();
  const publish = vi.spyOn(bus, 'publish');
  const runtime = new PitStopRuntime(
    bus,
    createSessionLifecycle(),
    { markStart: vi.fn(), markEnd: vi.fn() },
    persistence
  );
  const published = () =>
    publish.mock.calls.at(-1)?.[1] as { stops: PitStopRecord[] } | undefined;
  return { runtime, persistence, loads, published };
};

describe('PitStopRuntime', () => {
  it('restores the saved stops of the current session', async () => {
    const { runtime, loads, published } = setup();
    runtime.onSession(session(1001));
    runtime.onFrame(frame(100));
    loads.get(1001)?.([savedStop]);
    await settle();
    expect(published()?.stops).toEqual([savedStop]);
  });

  it('drops a restore that finishes after the event has changed', async () => {
    const { runtime, persistence, loads, published } = setup();
    runtime.onSession(session(1001));
    runtime.onFrame(frame(100));
    runtime.onSession(session(2002));
    loads.get(1001)?.([savedStop]);
    await settle();

    expect(published()?.stops ?? []).toEqual([]);
    expect(persistence.save).not.toHaveBeenCalled();

    runtime.onFrame(frame(10));
    expect(persistence.load).toHaveBeenLastCalledWith({
      subSessionId: 2002,
      sessionNum: 0,
    });
  });
});
