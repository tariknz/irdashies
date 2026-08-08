import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { RadioRuntime } from './radioRuntime';

const frame = (carIdxs: number[]) =>
  ({ RadioTransmitCarIdx: { value: carIdxs } }) as Telemetry;
const target = {
  id: 1,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};
const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

describe('RadioRuntime', () => {
  it('publishes changed radio state only while demanded', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new RadioRuntime(bus, undefined, metrics());
    runtime.onFrame(frame([5]));
    expect(publish).not.toHaveBeenCalled();

    bus.subscribe(target, 'radio.snapshot');
    runtime.onFrame(frame([5]));
    runtime.onFrame(frame([5]));
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      'radio.snapshot',
      expect.objectContaining({ transmittingCarIdxs: [5] })
    );

    bus.unsubscribe(target.id, 'radio.snapshot');
    runtime.onFrame(frame([8]));
    expect(publish).toHaveBeenCalledOnce();
  });

  it('activates for subscribers that predate the runtime', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'radio.snapshot');
    const runtime = new RadioRuntime(bus, undefined, metrics());
    runtime.onFrame(frame([5]));
    expect(publish).toHaveBeenCalledOnce();
  });

  it('clears cached state when disposed', () => {
    const bus = new ChannelBus();
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'radio.snapshot');
    const runtime = new RadioRuntime(bus, undefined, metrics());
    runtime.onFrame(frame([5]));
    runtime.dispose();
    expect(clearSnapshot).toHaveBeenLastCalledWith('radio.snapshot');
  });
});
