import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';

const mockGetSessionData = vi.hoisted(() => vi.fn());
const mockWaitForData = vi.hoisted(() => vi.fn());
const mockStopSDK = vi.hoisted(() => vi.fn());

vi.mock('../../irsdk', () => ({
  IRacingSDK: class {
    autoEnableTelemetry = false;
    currDataVersion = 1;
    sessionStatusOK = true;

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
});
