import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { CHANNEL_DELIVERY, ChannelBus } from '../bridge/channelBridge';
import { TrackStateRuntime } from './trackStateRuntime';

const frame = (position: number) =>
  ({ CarIdxLapDistPct: { value: [position] } }) as Telemetry;
const target = {
  id: 71,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};
const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

describe('TrackStateRuntime', () => {
  it('processes only while demanded and activates existing subscribers', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'track-state.snapshot');
    const runtime = new TrackStateRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(0.2));
    runtime.onFrame(frame(0.2));
    expect(publish).toHaveBeenCalledOnce();

    bus.unsubscribe(target.id, 'track-state.snapshot');
    runtime.onFrame(frame(0.3));
    expect(publish).toHaveBeenCalledOnce();
  });

  it('publishes reset state and clears the cache on dispose', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'track-state.snapshot');
    const runtime = new TrackStateRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(0.2));
    runtime.dispose();
    expect(publish).toHaveBeenLastCalledWith(
      'track-state.snapshot',
      expect.objectContaining({ carIdxLapDistPct: [], isOnTrack: false })
    );
    expect(clearSnapshot).toHaveBeenLastCalledWith('track-state.snapshot');
  });

  it('stops processing while every registered subscriber is hidden', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const visibleTarget = {
      id: 72,
      visible: true,
      isDestroyed: () => false,
      isVisible() {
        return this.visible;
      },
      send: vi.fn(),
    };
    const runtime = new TrackStateRuntime(bus, undefined, metrics());
    bus.subscribe(visibleTarget, 'track-state.snapshot');
    runtime.onFrame(frame(0.2));
    expect(publish).toHaveBeenCalledOnce();
    expect(visibleTarget.send).toHaveBeenCalledOnce();

    visibleTarget.visible = false;
    bus.rendererBecameHidden(visibleTarget.id);
    runtime.onFrame(frame(0.3));
    expect(bus.registeredSubscriberCount('track-state.snapshot')).toBe(1);
    expect(bus.subscriberCount('track-state.snapshot')).toBe(0);
    expect(publish).toHaveBeenCalledOnce();

    visibleTarget.visible = true;
    bus.rendererBecameVisible(visibleTarget.id);
    expect(visibleTarget.send).toHaveBeenCalledOnce();

    runtime.onFrame(frame(0.4));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(visibleTarget.send).toHaveBeenCalledTimes(2);
    expect(visibleTarget.send).toHaveBeenLastCalledWith(
      CHANNEL_DELIVERY,
      'track-state.snapshot',
      expect.objectContaining({ carIdxLapDistPct: [0.4] })
    );
  });
});
