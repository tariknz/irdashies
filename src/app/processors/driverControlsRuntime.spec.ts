import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { DriverControlsRuntime } from './driverControlsRuntime';

const frame = (gear: number, rpm: number) =>
  ({ Gear: { value: [gear] }, RPM: { value: [rpm] } }) as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};
const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

describe('DriverControlsRuntime', () => {
  it('publishes changed controls only while demanded', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new DriverControlsRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(2, 5000));
    expect(publish).not.toHaveBeenCalled();

    bus.subscribe(target, 'driver-controls.snapshot');
    runtime.onFrame(frame(2, 5000));
    runtime.onFrame(frame(2, 5000));
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      'driver-controls.snapshot',
      expect.objectContaining({ gear: 2, rpm: 5000 })
    );

    bus.unsubscribe(target.id, 'driver-controls.snapshot');
    runtime.onFrame(frame(3, 6000));
    expect(publish).toHaveBeenCalledOnce();
  });

  it('activates for subscribers that predate the runtime', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'driver-controls.snapshot');
    const runtime = new DriverControlsRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(4, 6500));
    expect(publish).toHaveBeenCalledOnce();
  });

  it('publishes a reset and clears cached state when disposed', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'driver-controls.snapshot');
    const runtime = new DriverControlsRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(4, 6500));
    runtime.dispose();
    expect(publish).toHaveBeenLastCalledWith(
      'driver-controls.snapshot',
      expect.objectContaining({ gear: undefined, rpm: undefined })
    );
    expect(clearSnapshot).toHaveBeenLastCalledWith('driver-controls.snapshot');
  });
});
