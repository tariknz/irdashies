import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { SectorTimingRuntime } from './sectorTimingRuntime';

const session = {
  SplitTimeInfo: {
    Sectors: [
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.5 },
    ],
  },
} as Session;
const telemetry = {
  LapDistPct: { value: [0.2] },
  SessionTime: { value: [20] },
  IsOnTrack: { value: [true] },
  SessionNum: { value: [1] },
} as unknown as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

describe('SectorTimingRuntime', () => {
  it('activates only while the channel has subscribers', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new SectorTimingRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).not.toHaveBeenCalled();

    bus.subscribe(target, 'sector-timing.snapshot');
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledWith(
      'sector-timing.snapshot',
      expect.objectContaining({ currentSectorIdx: 0 })
    );

    bus.unsubscribe(target.id, 'sector-timing.snapshot');
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('activates when subscribers predate runtime replacement', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'sector-timing.snapshot');
    const runtime = new SectorTimingRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('clears the cached snapshot when disposed', () => {
    const bus = new ChannelBus();
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'sector-timing.snapshot');
    const runtime = new SectorTimingRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.dispose();
    expect(clearSnapshot).toHaveBeenLastCalledWith('sector-timing.snapshot');
  });
});
