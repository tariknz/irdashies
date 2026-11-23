import { describe, expect, it, vi } from 'vitest';

vi.mock('../bridge/iracingSdk/setup', () => ({
  getCurrentBridge: vi.fn(() => undefined),
  onBridgeChanged: vi.fn(() => () => undefined),
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { ReplayDirectorRuntime } from './replayDirectorRuntime';

describe('ReplayDirectorRuntime', () => {
  it('inactive on tape — does not publish when tape replay is active', () => {
    const bus = new ChannelBus();
    const lifecycle = createSessionLifecycle();
    const getTapeReplayStatus = vi.fn(() => ({ paused: true }));

    const runtime = new ReplayDirectorRuntime(
      bus,
      lifecycle,
      getTapeReplayStatus
    );
    const publishSpy = vi.spyOn(bus, 'publish');

    runtime.cut();
    expect(publishSpy).not.toHaveBeenCalled();

    runtime.dispose();
  });

  it('publishes snapshot when cut is called without tape active', () => {
    const bus = new ChannelBus();
    const lifecycle = createSessionLifecycle();
    const getTapeReplayStatus = vi.fn(() => null);

    const runtime = new ReplayDirectorRuntime(
      bus,
      lifecycle,
      getTapeReplayStatus
    );
    const publishSpy = vi.spyOn(bus, 'publish');

    runtime.cut();
    expect(publishSpy).toHaveBeenCalledWith(
      'replay.timecode',
      expect.any(Object)
    );

    runtime.dispose();
  });

  it('stayHere clears cut-away state', async () => {
    const bus = new ChannelBus();
    const lifecycle = createSessionLifecycle();
    const getTapeReplayStatus = vi.fn(() => null);

    const runtime = new ReplayDirectorRuntime(
      bus,
      lifecycle,
      getTapeReplayStatus
    );
    const publishSpy = vi.spyOn(bus, 'publish');

    runtime.cut();
    publishSpy.mockClear();

    await runtime.stayHere();
    expect(publishSpy).toHaveBeenCalledWith(
      'replay.timecode',
      expect.objectContaining({
        program: expect.objectContaining({ state: 'onProgram' }),
      })
    );

    runtime.dispose();
  });
});
