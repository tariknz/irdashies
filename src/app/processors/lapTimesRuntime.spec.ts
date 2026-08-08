import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { LapTimesRuntime } from './lapTimesRuntime';

const telemetry = (lapTime: number) =>
  ({
    CarIdxLastLapTime: { value: [lapTime] },
    SessionNum: { value: [1] },
  }) as unknown as Telemetry;

const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

describe('LapTimesRuntime', () => {
  it('activates for a subscriber that predates construction', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'lap-times.snapshot');
    const runtime = new LapTimesRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onFrame(telemetry(90));
    expect(publish).toHaveBeenCalledWith(
      'lap-times.snapshot',
      expect.objectContaining({ sessionNum: 1 })
    );
  });

  it('activates on demand and publishes only changed snapshots', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const runtime = new LapTimesRuntime(bus, createSessionLifecycle(), metrics);

    runtime.onFrame(telemetry(90));
    expect(publish).not.toHaveBeenCalled();
    bus.subscribe(target, 'lap-times.snapshot');
    runtime.onFrame(telemetry(90));
    runtime.onFrame(telemetry(90));
    expect(publish).toHaveBeenCalledTimes(1);

    runtime.onFrame(telemetry(89));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith(
      'lap-times.snapshot',
      expect.objectContaining({ lapTimeHistory: [[89]] })
    );
    expect(metrics.markStart).toHaveBeenCalledWith('lapTimesProcessing');
  });

  it('suppresses replay scrubbing unless chronological tape mode is enabled', () => {
    const lifecycle = createSessionLifecycle();
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new LapTimesRuntime(bus, lifecycle, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    lifecycle._onEnter({ replay: true });
    bus.subscribe(target, 'lap-times.snapshot');
    runtime.onFrame(telemetry(90));
    expect(publish).toHaveBeenCalledWith(
      'lap-times.snapshot',
      expect.objectContaining({ lapTimeHistory: [] })
    );

    const tapeBus = new ChannelBus();
    const tapePublish = vi.spyOn(tapeBus, 'publish');
    const tapeRuntime = new LapTimesRuntime(
      tapeBus,
      lifecycle,
      { markStart: vi.fn(), markEnd: vi.fn() },
      true
    );
    tapeBus.subscribe({ ...target, id: 2 }, 'lap-times.snapshot');
    tapeRuntime.onFrame(telemetry(90));
    tapeRuntime.onFrame(telemetry(89));
    expect(tapePublish).toHaveBeenLastCalledWith(
      'lap-times.snapshot',
      expect.objectContaining({ lapTimeHistory: [[89]] })
    );
  });
});
