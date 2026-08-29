import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';

const mockGetSessionData = vi.hoisted(() => vi.fn());
const mockWaitForData = vi.hoisted(() => vi.fn());
const mockStopSDK = vi.hoisted(() => vi.fn());
const mockSdkState = vi.hoisted(() => ({
  sessionVersion: 1,
  sessionStatusOK: true,
}));

vi.mock('../../irsdk', () => ({
  IRacingSDK: class {
    autoEnableTelemetry = false;
    get sessionStatusOK() {
      return mockSdkState.sessionStatusOK;
    }

    get currDataVersion() {
      return mockSdkState.sessionVersion;
    }

    ready = vi.fn().mockResolvedValue(true);
    waitForData = mockWaitForData;
    getTelemetry = vi.fn().mockReturnValue(null);
    getSessionData = mockGetSessionData;
    stopSDK = mockStopSDK;
  },
}));

vi.mock('../../perfMetrics', () => ({
  TelemetryPerfMetrics: class {
    startReporting = vi.fn();
    stopReporting = vi.fn();
    markStart = vi.fn();
    markEnd = vi.fn();
    tick = vi.fn();
  },
}));

vi.mock('../../perfRunConfig', () => ({
  getPerfRunConfig: () => ({ enabled: false }),
  PERF_REPLAY_READY_LOG_MARKER: 'replay-ready',
}));

vi.mock('../../logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { publishIRacingSDKEvents } from './iracingSdkBridge';

describe('publishIRacingSDKEvents session polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    mockGetSessionData.mockReset();
    mockGetSessionData.mockReturnValue({} as Session);
    mockWaitForData.mockReset();
    mockWaitForData.mockReturnValue(true);
    mockStopSDK.mockReset();
    mockSdkState.sessionVersion = 1;
    mockSdkState.sessionStatusOK = true;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createOverlayManager = () => ({
    onOverlayReady: vi.fn(),
    publishMessage: vi.fn(),
    publishMessageToOverlay: vi.fn(),
  });

  it('publishes the running state as soon as the SDK produces data', async () => {
    // sessionStatusOK still reads false when the bridge seeds it, which is what
    // left overlays believing the sim was down until the 5s poll caught up. A
    // successful waitForData is the proof the sim is up, matching the existing
    // wasRunning / lifecycle enter trigger; getTelemetry may still be null.
    mockSdkState.sessionStatusOK = false;
    const overlayManager = createOverlayManager();

    const bridge = await publishIRacingSDKEvents(overlayManager as never);

    // Well inside the 5s poll interval.
    await vi.advanceTimersByTimeAsync(100);

    const runningStateCalls = overlayManager.publishMessage.mock.calls.filter(
      ([channel]) => channel === 'runningState'
    );
    expect(runningStateCalls).toEqual([
      ['runningState', false],
      ['runningState', true],
    ]);

    bridge.stop();
  });

  it('polls immediately and every 500 ms using monotonic time', async () => {
    const overlayManager = createOverlayManager();

    const bridge = await publishIRacingSDKEvents(overlayManager as never);

    expect(mockGetSessionData).toHaveBeenCalledTimes(1);

    // A backward wall-clock adjustment must not stall elapsed-time polling.
    vi.setSystemTime(new Date(-60_000));
    await vi.advanceTimersByTimeAsync(480);
    expect(mockGetSessionData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(40);
    expect(mockGetSessionData).toHaveBeenCalledTimes(2);

    bridge.stop();
  });

  it('polls immediately after reconnecting', async () => {
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );
    expect(mockGetSessionData).toHaveBeenCalledTimes(1);

    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValueOnce(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(mockGetSessionData).toHaveBeenCalledTimes(1);

    mockSdkState.sessionStatusOK = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockGetSessionData).toHaveBeenCalledTimes(2);

    bridge.stop();
  });

  it('retains session state through a connected replay pause', async () => {
    const overlayManager = {
      ...createOverlayManager(),
      clearLatestSessionData: vi.fn(),
    };
    const lifecycle = {
      _onEnter: vi.fn(),
      _onTelemetry: vi.fn(),
      _onSession: vi.fn(),
      _onDisconnect: vi.fn(),
    };
    const session = { WeekendInfo: {} } as Session;
    mockGetSessionData.mockReturnValue(session);

    const bridge = await publishIRacingSDKEvents(
      overlayManager as never,
      lifecycle as never
    );
    expect(lifecycle._onEnter).toHaveBeenCalledOnce();

    mockWaitForData.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(1_200);

    expect(lifecycle._onDisconnect).not.toHaveBeenCalled();
    expect(overlayManager.clearLatestSessionData).not.toHaveBeenCalled();

    const callback = vi.fn();
    bridge.onSessionData(callback);
    expect(callback).toHaveBeenCalledWith(session);

    mockWaitForData.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(80);
    expect(mockGetSessionData.mock.calls.length).toBeGreaterThan(1);

    bridge.stop();
  });

  it('publishes session data only when its SDK revision changes', async () => {
    const overlayManager = createOverlayManager();
    const bridge = await publishIRacingSDKEvents(overlayManager as never);

    expect(overlayManager.publishMessage).toHaveBeenCalledTimes(2);
    expect(overlayManager.publishMessage).toHaveBeenCalledWith(
      'sessionData',
      expect.any(Object)
    );

    await vi.advanceTimersByTimeAsync(1_100);
    expect(
      overlayManager.publishMessage.mock.calls.filter(
        ([channel]) => channel === 'sessionData'
      )
    ).toHaveLength(1);

    mockSdkState.sessionVersion = 2;
    await vi.advanceTimersByTimeAsync(500);
    expect(
      overlayManager.publishMessage.mock.calls.filter(
        ([channel]) => channel === 'sessionData'
      )
    ).toHaveLength(2);

    bridge.stop();
  });

  it('seeds a late session subscriber with the latest revision', async () => {
    const session = { WeekendInfo: {} } as Session;
    mockGetSessionData.mockReturnValue(session);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );
    const callback = vi.fn();

    bridge.onSessionData(callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(session);
    bridge.stop();
  });
});
