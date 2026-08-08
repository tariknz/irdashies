import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { CarSpeedsRuntime } from './carSpeedsRuntime';

const telemetry = (pct: number, time: number) =>
  ({
    CarIdxLapDistPct: { value: [pct] },
    SessionTime: { value: [time] },
    SessionNum: { value: [1] },
  }) as unknown as Telemetry;
const session = {
  WeekendInfo: { TrackLength: '1 km' },
} as Session;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};

describe('CarSpeedsRuntime', () => {
  it('activates when subscribers predate runtime replacement', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'car-speeds.snapshot');
    const runtime = new CarSpeedsRuntime(bus, createSessionLifecycle(), {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry(0.1, 1));
    runtime.onFrame(telemetry(0.11, 1.1));
    expect(publish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [360] })
    );
  });

  it('activates on demand and uses the latest session', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const runtime = new CarSpeedsRuntime(
      bus,
      createSessionLifecycle(),
      metrics
    );
    runtime.onSession(session);
    runtime.onFrame(telemetry(0.1, 1));
    expect(publish).not.toHaveBeenCalled();
    bus.subscribe(target, 'car-speeds.snapshot');
    runtime.onFrame(telemetry(0.1, 1));
    runtime.onFrame(telemetry(0.11, 1.1));
    expect(publish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [360] })
    );
    expect(metrics.markStart).toHaveBeenCalledWith('carSpeedsProcessing');
  });

  it('suppresses normal replay scrubbing but aggregates curated tape replay', () => {
    const lifecycle = createSessionLifecycle();
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new CarSpeedsRuntime(bus, lifecycle, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    lifecycle._onEnter({ replay: true });
    bus.subscribe(target, 'car-speeds.snapshot');
    runtime.onFrame(telemetry(0.1, 1));
    expect(publish).toHaveBeenCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [] })
    );

    const tapeBus = new ChannelBus();
    const tapePublish = vi.spyOn(tapeBus, 'publish');
    const tapeRuntime = new CarSpeedsRuntime(
      tapeBus,
      lifecycle,
      { markStart: vi.fn(), markEnd: vi.fn() },
      true
    );
    tapeRuntime.onSession(session);
    tapeBus.subscribe({ ...target, id: 2 }, 'car-speeds.snapshot');
    tapeRuntime.onFrame(telemetry(0.1, 1));
    tapeRuntime.onFrame(telemetry(0.11, 1.1));
    expect(tapePublish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [360] })
    );
  });

  it('publishes a reset and clears the cached snapshot on dispose', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'car-speeds.snapshot');
    const runtime = new CarSpeedsRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onSession(session);
    runtime.onFrame(telemetry(0.1, 1));
    runtime.onFrame(telemetry(0.11, 1.1));

    runtime.dispose();

    expect(publish).toHaveBeenLastCalledWith('car-speeds.snapshot', {
      carSpeeds: [],
      sessionNum: null,
      version: 3,
    });
    expect(clearSnapshot).toHaveBeenLastCalledWith('car-speeds.snapshot');
  });
});
