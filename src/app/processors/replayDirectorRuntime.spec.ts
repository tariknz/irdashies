import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrSdkSourceBridge, Session, Telemetry } from '@irdashies/types';
import { getCurrentBridge } from '../bridge/iracingSdk/setup';

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
  beforeEach(() => vi.mocked(getCurrentBridge).mockReturnValue(undefined));
  afterEach(() => vi.useRealTimers());

  it.each([
    { playSpeed: 0, slowMotion: false },
    { playSpeed: 4, slowMotion: true },
    { playSpeed: 2, slowMotion: false },
  ])(
    'restores the cue position, camera and playback state: %j',
    async ({ playSpeed, slowMotion }) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const bridge = {
        onSessionData: vi.fn<NonNullable<IrSdkSourceBridge['onSessionData']>>(),
        onTelemetry: vi.fn<IrSdkSourceBridge['onTelemetry']>(),
        changeReplaySpeed: vi.fn(),
        triggerReplaySessionSearch: vi.fn(),
        changeCameraNumber: vi.fn(),
      };
      vi.mocked(getCurrentBridge).mockReturnValue(
        bridge as unknown as IrSdkSourceBridge
      );
      const bus = new ChannelBus();
      const runtime = new ReplayDirectorRuntime(
        bus,
        createSessionLifecycle(),
        () => null
      );
      const publish = vi.spyOn(bus, 'publish');
      const sessionCallback = bridge.onSessionData.mock.calls[0][0] as (
        session: Session
      ) => void;
      const telemetryCallback = bridge.onTelemetry.mock.calls[0][0] as (
        telemetry: Telemetry
      ) => void;
      sessionCallback({
        DriverInfo: { Drivers: [{ CarIdx: 7, CarNumber: '042' }] },
      } as unknown as Session);
      telemetryCallback({
        IsReplayPlaying: { value: [true] },
        ReplayFrameNum: { value: [6000] },
        ReplayFrameNumEnd: { value: [10000] },
        ReplaySessionTime: { value: [100] },
        ReplaySessionNum: { value: [2] },
        ReplayPlaySpeed: { value: [playSpeed] },
        ReplayPlaySlowMotion: { value: [slowMotion] },
        CamCarIdx: { value: [7] },
        CamGroupNumber: { value: [3] },
        CamCameraNumber: { value: [5] },
      } as unknown as Telemetry);
      runtime.cut();
      await runtime.resumeAtCut();

      expect(bridge.changeReplaySpeed).toHaveBeenCalledExactlyOnceWith(
        playSpeed,
        slowMotion
      );
      expect(bridge.triggerReplaySessionSearch).toHaveBeenCalledExactlyOnceWith(
        2,
        100000
      );
      expect(bridge.changeCameraNumber).toHaveBeenCalledExactlyOnceWith(
        '042',
        3,
        5
      );
      const elapsed = playSpeed === 2 ? 1 : 4;
      vi.setSystemTime(elapsed * 1000);
      telemetryCallback({
        IsReplayPlaying: { value: [true] },
        ReplayFrameNum: { value: [6000] },
        ReplayFrameNumEnd: { value: [10000] },
        ReplaySessionTime: { value: [50] },
        ReplaySessionNum: { value: [2] },
      } as unknown as Telemetry);
      const speed = slowMotion ? 1 / playSpeed : playSpeed;
      expect(publish).toHaveBeenLastCalledWith(
        'replay.timecode',
        expect.objectContaining({
          program: expect.objectContaining({
            state: 'onProgram',
            sessionTime: 100 + elapsed * speed,
          }),
        })
      );
      runtime.dispose();
    }
  );

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
