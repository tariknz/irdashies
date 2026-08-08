import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { SessionTimingRuntime } from './sessionTimingRuntime';
import { LapTimesRuntime } from './lapTimesRuntime';

const frame = {
  SessionTime: { value: [1] },
  SessionNum: { value: [0] },
} as unknown as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};
const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });
const lapTimesRuntime = (bus: ChannelBus) =>
  new LapTimesRuntime(
    bus,
    {
      onEnter: () => () => undefined,
      onSessionNumChange: () => () => undefined,
      onDisconnect: () => () => undefined,
    } as never,
    metrics()
  );

describe('SessionTimingRuntime', () => {
  it('processes only while the channel is demanded', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new SessionTimingRuntime(
      bus,
      undefined,
      metrics(),
      lapTimesRuntime(bus)
    );
    runtime.onFrame(frame);
    expect(publish).not.toHaveBeenCalled();
    bus.subscribe(target, 'session-timing.snapshot');
    runtime.onFrame(frame);
    expect(publish).toHaveBeenCalledWith(
      'session-timing.snapshot',
      expect.objectContaining({ time: 1 })
    );
    bus.unsubscribe(target.id, 'session-timing.snapshot');
    runtime.onFrame({ SessionTime: { value: [2] } } as unknown as Telemetry);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('activates for a subscriber that predates the runtime', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'session-timing.snapshot');
    const runtime = new SessionTimingRuntime(
      bus,
      undefined,
      metrics(),
      lapTimesRuntime(bus)
    );
    runtime.onFrame(frame);
    expect(publish).toHaveBeenCalledOnce();
  });
});
