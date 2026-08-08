import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { SessionBarRuntime } from './sessionBarRuntime';

describe('SessionBarRuntime', () => {
  it('publishes a reset snapshot before disposal', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(
      { id: 1, isDestroyed: () => false, isVisible: () => true, send: vi.fn() },
      'session-bar.snapshot'
    );
    const runtime = new SessionBarRuntime(bus, undefined, {
      markStart: vi.fn(),
      markEnd: vi.fn(),
    });
    runtime.onFrame({
      SessionTime: { value: [1] },
      SessionNum: { value: [1] },
      FuelLevel: { value: [30] },
    } as unknown as Telemetry);
    runtime.dispose();
    expect(publish).toHaveBeenLastCalledWith(
      'session-bar.snapshot',
      expect.objectContaining({ fuelLevel: undefined, sessionNum: null })
    );
  });
});
