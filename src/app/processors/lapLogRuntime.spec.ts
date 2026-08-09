import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { LapLogRuntime } from './lapLogRuntime';

const frame = (position: number) =>
  ({ LapCompleted: { value: [position] } }) as Telemetry;
const target = {
  id: 71,
  isDestroyed: () => false,
  isVisible: () => true,
  send: vi.fn(),
};
const metrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

describe('LapLogRuntime', () => {
  it('processes only while demanded and activates existing subscribers', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(target, 'lap-log.snapshot');
    const runtime = new LapLogRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(0.2));
    runtime.onFrame(frame(0.2));
    expect(publish).toHaveBeenCalledTimes(2);

    bus.unsubscribe(target.id, 'lap-log.snapshot');
    runtime.onFrame(frame(0.3));
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('publishes reset state and clears the cache on dispose', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const clearSnapshot = vi.spyOn(bus, 'clearSnapshot');
    bus.subscribe(target, 'lap-log.snapshot');
    const runtime = new LapLogRuntime(bus, undefined, metrics());
    runtime.onFrame(frame(0.2));
    runtime.dispose();
    expect(publish).toHaveBeenLastCalledWith(
      'lap-log.snapshot',
      expect.objectContaining({ lapCompleted: 0, sessionNum: null })
    );
    expect(clearSnapshot).toHaveBeenLastCalledWith('lap-log.snapshot');
  });
});
