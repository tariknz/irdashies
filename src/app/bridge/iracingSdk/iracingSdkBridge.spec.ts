import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';

const mockGetSessionData = vi.hoisted(() => vi.fn());
const mockWaitForData = vi.hoisted(() => vi.fn());
const mockStopSDK = vi.hoisted(() => vi.fn());
const mockSdkState = vi.hoisted(() => ({ sessionVersion: 1 }));

vi.mock('../../irsdk', () => ({
  IRacingSDK: class {
    autoEnableTelemetry = false;
    sessionStatusOK = true;

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

    mockWaitForData.mockReturnValueOnce(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(mockGetSessionData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockGetSessionData).toHaveBeenCalledTimes(2);

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
