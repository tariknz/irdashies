import { describe, expect, it, vi } from 'vitest';
import { createPreviewFrameBridge } from './frameBridge';

describe('preview frame bridge', () => {
  it('aggregates demand and isolates subscribers and snapshot caches between frames', () => {
    const send = vi.fn();
    const first = createPreviewFrameBridge(send);
    const second = createPreviewFrameBridge(vi.fn());
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    second.bridge.subscribe('driver-controls.snapshot', onSecond);
    const stop = first.bridge.subscribe(
      'driver-controls.snapshot',
      onFirst,
      10
    );
    const stopFast = first.bridge.subscribe(
      'driver-controls.snapshot',
      vi.fn(),
      25
    );
    expect(send).toHaveBeenLastCalledWith({
      type: 'preview:subscribe',
      channel: 'driver-controls.snapshot',
      rate: 25,
    });
    first.receive('driver-controls.snapshot', {
      throttle: 0.7,
      brake: 0,
      gear: 4,
      brakeAbsActive: false,
      version: 1,
    });
    expect(onFirst).toHaveBeenCalledOnce();
    expect(onSecond).not.toHaveBeenCalled();
    stopFast();
    expect(send).toHaveBeenLastCalledWith({
      type: 'preview:subscribe',
      channel: 'driver-controls.snapshot',
      rate: 10,
    });
    stop();
    expect(send).toHaveBeenLastCalledWith({
      type: 'preview:unsubscribe',
      channel: 'driver-controls.snapshot',
    });
  });
});
