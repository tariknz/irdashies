import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';
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
});
