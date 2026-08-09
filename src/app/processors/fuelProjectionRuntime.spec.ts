import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { FuelProjectionRuntime } from './fuelProjectionRuntime';

const telemetry = {
  FuelLevel: { value: [40] },
  Lap: { value: [1] },
  LapDistPct: { value: [0.1] },
  SessionTime: { value: [10] },
} as unknown as Telemetry;

describe('FuelProjectionRuntime', () => {
  it('activates when the channel was subscribed before construction', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(
      {
        id: 4,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'fuel.projection'
    );

    const runtime = new FuelProjectionRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onFrame(telemetry);

    expect(publish).toHaveBeenCalledWith(
      'fuel.projection',
      expect.objectContaining({ fuelLevel: 40 })
    );
  });

  it('processes and publishes only while the channel has subscribers', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const runtime = new FuelProjectionRuntime(
      bus,
      createSessionLifecycle(),
      metrics
    );
    runtime.onSession({} as Session);

    runtime.onFrame(telemetry);
    expect(publish).not.toHaveBeenCalled();

    const target = {
      id: 1,
      isDestroyed: () => false,
      isVisible: () => true,
      send: vi.fn(),
    };
    bus.subscribe(target, 'fuel.projection');
    runtime.onFrame(telemetry);

    expect(publish).toHaveBeenCalledWith(
      'fuel.projection',
      expect.objectContaining({ fuelLevel: 40 })
    );
    expect(metrics.markStart).toHaveBeenCalledWith('fuelProjectionProcessing');

    bus.unsubscribe(1, 'fuel.projection');
    publish.mockClear();
    runtime.onFrame(telemetry);
    expect(publish).not.toHaveBeenCalled();
  });

  it('remembers replay mode for subscribers that activate later', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const lifecycle = createSessionLifecycle();
    const runtime = new FuelProjectionRuntime(bus, lifecycle, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    lifecycle._onEnter({ replay: true });

    bus.subscribe(
      {
        id: 2,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'fuel.projection'
    );
    runtime.onFrame(telemetry);

    expect(publish).toHaveBeenCalledWith(
      'fuel.projection',
      expect.objectContaining({ fuelLevel: 0, currentLap: 0 })
    );
  });

  it('aggregates chronological tape replay when explicitly enabled', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const lifecycle = createSessionLifecycle();
    const runtime = new FuelProjectionRuntime(
      bus,
      lifecycle,
      { markStart: vi.fn(), markEnd: vi.fn() },
      { aggregateReplay: true }
    );
    lifecycle._onEnter({ replay: true });
    bus.subscribe(
      {
        id: 3,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'fuel.projection'
    );

    runtime.onFrame(telemetry);

    expect(publish).toHaveBeenCalledWith(
      'fuel.projection',
      expect.objectContaining({
        fuelLevel: 40,
        currentLap: 1,
        isReplay: true,
      })
    );
  });

  it('clears cached snapshots when the final subscriber leaves', () => {
    const bus = new ChannelBus();
    const first = {
      id: 5,
      isDestroyed: () => false,
      isVisible: () => true,
      send: vi.fn(),
    };
    bus.subscribe(first, 'fuel.projection');
    const runtime = new FuelProjectionRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onFrame(telemetry);
    bus.unsubscribe(first.id, 'fuel.projection');

    const second = {
      ...first,
      id: 6,
      send: vi.fn(),
    };
    bus.subscribe(second, 'fuel.projection');

    expect(second.send).not.toHaveBeenCalled();
    runtime.onFrame({
      ...telemetry,
      FuelLevel: { value: [20] },
    } as unknown as Telemetry);
    expect(second.send).toHaveBeenCalledWith(
      'channels:delivery',
      'fuel.projection',
      expect.objectContaining({ fuelLevel: 20 })
    );
  });

  it('clears cached state on dispose and restarts from a fresh processor', () => {
    const bus = new ChannelBus();
    const target = {
      id: 7,
      isDestroyed: () => false,
      isVisible: () => true,
      send: vi.fn(),
    };
    bus.subscribe(target, 'fuel.projection');
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const first = new FuelProjectionRuntime(bus, undefined, metrics);
    first.onFrame(telemetry);
    first.dispose();
    target.send.mockClear();
    const publish = vi.spyOn(bus, 'publish');

    const restarted = new FuelProjectionRuntime(bus, undefined, metrics);
    expect(target.send).not.toHaveBeenCalled();
    restarted.onFrame({
      ...telemetry,
      FuelLevel: { value: [15] },
    } as unknown as Telemetry);

    expect(publish).toHaveBeenCalledWith(
      'fuel.projection',
      expect.objectContaining({ fuelLevel: 15 })
    );
  });
});
