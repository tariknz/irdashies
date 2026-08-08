import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { StandingsRuntime } from './standingsRuntime';

const session = { DriverInfo: { DriverCarIdx: 0 } } as Session;
const telemetry = {
  SessionTime: { value: [10] },
  SessionNum: { value: [1] },
  CamCarIdx: { value: [0] },
  CarIdxLap: { value: [2] },
  CarIdxLapDistPct: { value: [0.5] },
} as unknown as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

describe('StandingsRuntime', () => {
  it('processes and publishes only while demanded', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new StandingsRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).not.toHaveBeenCalled();

    bus.subscribe(target, 'standings.snapshot');
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledWith(
      'standings.snapshot',
      expect.objectContaining({ carIdxLap: [2] })
    );

    bus.unsubscribe(target.id, 'standings.snapshot');
    runtime.onFrame({
      ...telemetry,
      SessionTime: { value: [11] },
    } as unknown as Telemetry);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('activates when subscribers predate runtime replacement', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'standings.snapshot');
    const runtime = new StandingsRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('clears cached state when disposed', () => {
    const bus = new ChannelBus();
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'standings.snapshot');
    const runtime = new StandingsRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.dispose();
    expect(clearSnapshot).toHaveBeenLastCalledWith('standings.snapshot');
  });
});
