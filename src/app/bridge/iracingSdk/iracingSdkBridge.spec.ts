import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';

const mockGetSessionData = vi.hoisted(() => vi.fn());
const mockWaitForData = vi.hoisted(() => vi.fn());
const mockReady = vi.hoisted(() => vi.fn());
const mockGetTelemetry = vi.hoisted(() => vi.fn());
const mockStopReporting = vi.hoisted(() => vi.fn());
const mockMarkStart = vi.hoisted(() => vi.fn());
const mockMarkEnd = vi.hoisted(() => vi.fn());
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

    ready = mockReady;
    waitForData = mockWaitForData;
    getTelemetry = mockGetTelemetry;
    getSessionData = mockGetSessionData;
    stopSDK = mockStopSDK;
  },
}));

vi.mock('../../perfMetrics', () => ({
  TelemetryPerfMetrics: class {
    startReporting = vi.fn();
    stopReporting = mockStopReporting;
    markStart = mockMarkStart;
    markEnd = mockMarkEnd;
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

import logger from '../../logger';
import { createSessionLifecycle } from '../../sessionLifecycle';
import { publishIRacingSDKEvents } from './iracingSdkBridge';

describe('publishIRacingSDKEvents session polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    mockGetSessionData.mockReset();
    mockGetSessionData.mockReturnValue({} as Session);
    mockWaitForData.mockReset();
    mockWaitForData.mockReturnValue(true);
    mockStopSDK.mockReset();
    mockReady.mockReset().mockResolvedValue(true);
    mockGetTelemetry.mockReset().mockReturnValue(null);
    mockStopReporting.mockReset();
    mockMarkStart.mockReset();
    mockMarkEnd.mockReset();
    vi.mocked(logger.error).mockClear();
    offOverlayReady.mockClear();
    mockSdkState.sessionVersion = 1;
    mockSdkState.sessionStatusOK = true;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const offOverlayReady = vi.fn();
  const createOverlayManager = () => ({
    onOverlayReady: vi.fn(() => offOverlayReady),
    publishMessage: vi.fn(),
    publishMessageToOverlay: vi.fn(),
    hasTelemetryInspectorSubscribers: () => false,
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

  it('closes SDK wait and poll timings on a timeout iteration', async () => {
    mockWaitForData.mockReturnValue(false);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );

    await vi.advanceTimersByTimeAsync(1);

    expect(mockMarkStart.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkStart.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkPollIteration']);
    bridge.stop();
  });

  it('closes SDK wait and poll timings when the SDK disconnects', async () => {
    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValue(false);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );

    await vi.advanceTimersByTimeAsync(1);

    expect(mockMarkStart.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkStart.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkPollIteration']);
    bridge.stop();
  });

  it('closes SDK wait and poll timings for a normal frame', async () => {
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );

    await vi.advanceTimersByTimeAsync(1);

    expect(mockMarkStart.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkStart.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['processTelemetry']);
    bridge.stop();
  });

  it('closes SDK wait and poll timings when waitForData throws', async () => {
    mockWaitForData.mockImplementationOnce(() => {
      throw new Error('wait failed');
    });
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );

    await vi.advanceTimersByTimeAsync(1);

    expect(mockMarkStart.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkWaitForData']);
    expect(mockMarkStart.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(mockMarkEnd.mock.calls).toContainEqual(['sdkPollIteration']);
    expect(logger.error).toHaveBeenCalledWith(
      '[iracingSdkBridge] Telemetry poll failed; retrying',
      expect.any(Error)
    );
    bridge.stop();
  });

  it('stops listening for new overlays when it stops', async () => {
    // Each demo toggle builds a new bridge; a listener left behind sends every
    // new window the initial data once per toggle so far.
    const overlayManager = createOverlayManager();
    const bridge = await publishIRacingSDKEvents(overlayManager as never);
    offOverlayReady.mockClear();

    bridge.stop();

    expect(offOverlayReady).toHaveBeenCalledOnce();
  });

  it('synchronously resets the shared lifecycle once when stopped', async () => {
    mockGetTelemetry.mockReturnValue({
      SessionNum: { value: [0] },
      IsOnTrack: { value: [true] },
    } as Telemetry);
    mockGetSessionData.mockReturnValue({
      SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Practice' }] },
    } as Session);
    const lifecycle = createSessionLifecycle();
    const disconnected = vi.fn();
    lifecycle.onDisconnect(disconnected);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle
    );
    expect(lifecycle.getCurrentState()).toEqual({
      sessionType: 'Practice',
      isDriving: true,
      isWatching: true,
    });

    bridge.stop();

    expect(disconnected).toHaveBeenCalledOnce();
    expect(lifecycle.getCurrentState()).toEqual({
      sessionType: undefined,
      isDriving: undefined,
      isWatching: undefined,
    });
    bridge.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(disconnected).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not disconnect again when stopped during a reconnect delay', async () => {
    const lifecycle = createSessionLifecycle();
    const disconnected = vi.fn();
    lifecycle.onDisconnect(disconnected);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle
    );
    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(disconnected).toHaveBeenCalledOnce();

    bridge.stop();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(disconnected).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the source disconnected across failures before the first frame', async () => {
    mockWaitForData.mockImplementation(() => {
      throw new Error('native failed');
    });
    const lifecycle = createSessionLifecycle();
    const disconnected = vi.fn();
    lifecycle.onDisconnect(disconnected);
    const overlayManager = {
      ...createOverlayManager(),
      clearLatestSessionData: vi.fn(),
    };
    const bridge = await publishIRacingSDKEvents(
      overlayManager as never,
      lifecycle
    );
    const running = vi.fn();
    bridge.onRunningState(running);

    // Cross the running-state interval while sessionStatusOK still reads true.
    await vi.advanceTimersByTimeAsync(6_000);

    expect(mockWaitForData.mock.calls.length).toBeGreaterThan(1);
    expect(running.mock.calls).toEqual([[false]]);
    expect(disconnected).not.toHaveBeenCalled();
    bridge.stop();
    expect(disconnected).not.toHaveBeenCalled();
    expect(overlayManager.clearLatestSessionData).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replays the running state to a subscriber that attaches after the seed', async () => {
    // Auto-detect builds this bridge and only then subscribes to it. The state
    // is seeded during the build and afterwards published only on a change, so
    // without a replay the detector never learns the sim came up -- and then
    // reads the disconnect as a blip and never re-probes, leaving the app deaf
    // to a different sim started afterwards.
    mockSdkState.sessionStatusOK = true;
    const overlayManager = createOverlayManager();

    const bridge = await publishIRacingSDKEvents(overlayManager as never);

    const seen: boolean[] = [];
    bridge.onRunningState((value) => seen.push(value));

    expect(seen).toEqual([true]);

    bridge.stop();
  });

  it('replays a disconnected state rather than claiming the sim is up', async () => {
    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValue(false);
    const overlayManager = createOverlayManager();

    const bridge = await publishIRacingSDKEvents(overlayManager as never);

    const seen: boolean[] = [];
    bridge.onRunningState((value) => seen.push(value));

    expect(seen).toEqual([false]);

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

  it('isolates failing telemetry and session subscribers and keeps delivering', async () => {
    const telemetry = {
      Speed: { value: [1] },
    } satisfies Partial<Telemetry>;
    mockGetTelemetry.mockReturnValue(telemetry);
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );
    const failingTelemetry = vi.fn(() => {
      throw new Error('consumer failed');
    });
    const failingSession = vi.fn(() => {
      throw new Error('session failed');
    });
    const healthyTelemetry = vi.fn();
    const healthySession = vi.fn();
    bridge.onTelemetry(failingTelemetry);
    bridge.onTelemetry(healthyTelemetry);
    // Immediate cached delivery is protected too.
    expect(() => bridge.onSessionData(failingSession)).not.toThrow();
    bridge.onSessionData(healthySession);
    mockSdkState.sessionVersion = 2;

    await vi.advanceTimersByTimeAsync(1_100);

    expect(failingTelemetry.mock.calls.length).toBeGreaterThan(1);
    expect(healthyTelemetry).toHaveBeenCalledTimes(
      failingTelemetry.mock.calls.length
    );
    expect(healthyTelemetry).toHaveBeenLastCalledWith(telemetry);
    expect(failingSession).toHaveBeenCalledTimes(2);
    expect(healthySession).toHaveBeenCalledTimes(2);
    // Persistent subscriber errors do not flood the log on every tick.
    expect(logger.error).toHaveBeenCalledTimes(2);
    bridge.stop();
  });

  it('isolates running-state callbacks during initial delivery and reconnect', async () => {
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );
    const failing = vi.fn(() => {
      throw new Error('running-state failed');
    });
    const healthy = vi.fn();
    expect(() => bridge.onRunningState(failing)).not.toThrow();
    bridge.onRunningState(healthy);

    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValueOnce(false);
    await vi.advanceTimersByTimeAsync(40);
    mockSdkState.sessionStatusOK = true;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(healthy.mock.calls).toEqual([[true], [false], [true]]);
    expect(failing).toHaveBeenCalledTimes(3);
    bridge.stop();
  });

  it.each(['wait', 'read'])(
    'disconnects and retries after a native %s failure',
    async (operation) => {
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
      const bridge = await publishIRacingSDKEvents(
        overlayManager as never,
        lifecycle as never
      );
      const healthy = vi.fn();
      bridge.onRunningState(healthy);
      const operationMock =
        operation === 'wait' ? mockWaitForData : mockGetTelemetry;
      operationMock.mockImplementationOnce(() => {
        throw new Error('native failed');
      });

      await vi.advanceTimersByTimeAsync(40);
      expect(lifecycle._onDisconnect).toHaveBeenCalledOnce();
      expect(overlayManager.clearLatestSessionData).toHaveBeenCalledOnce();
      const lateSession = vi.fn();
      bridge.onSessionData(lateSession);
      expect(lateSession).not.toHaveBeenCalled();
      const reads = mockWaitForData.mock.calls.length;
      await vi.advanceTimersByTimeAsync(900);
      expect(mockWaitForData).toHaveBeenCalledTimes(reads);
      await vi.advanceTimersByTimeAsync(100);

      expect(healthy.mock.calls).toEqual([[true], [false], [true]]);
      expect(lifecycle._onEnter).toHaveBeenCalledTimes(2);
      expect(lateSession).toHaveBeenCalledOnce();
      bridge.stop();
    }
  );

  it('cleans up an entered lifecycle after bridge replacement fails its first poll', async () => {
    const lifecycle = {
      _onEnter: vi.fn(),
      _onSession: vi.fn(),
      _onTelemetry: vi.fn(),
      _onDisconnect: vi.fn(),
    };
    const first = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle as never
    );
    expect(lifecycle._onEnter).toHaveBeenCalledOnce();
    first.stop();
    // Stop synchronously disconnects the entered lifecycle so a replacement
    // source starts clean; the failed first poll must not disconnect again.
    expect(lifecycle._onDisconnect).toHaveBeenCalledOnce();
    mockWaitForData.mockImplementationOnce(() => {
      throw new Error('replacement poll failed');
    });
    const replacement = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle as never
    );
    expect(lifecycle._onDisconnect).toHaveBeenCalledOnce();
    replacement.stop();
  });

  it('recovers when the first native poll throws', async () => {
    mockWaitForData.mockImplementationOnce(() => {
      throw new Error('first poll failed');
    });
    const lifecycle = {
      _onEnter: vi.fn(),
      _onSession: vi.fn(),
      _onTelemetry: vi.fn(),
      _onDisconnect: vi.fn(),
    };
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle as never
    );
    expect(lifecycle._onDisconnect).not.toHaveBeenCalled();
    const healthy = vi.fn();
    bridge.onRunningState(healthy);
    expect(healthy).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(healthy).toHaveBeenLastCalledWith(true);
    expect(mockGetSessionData).toHaveBeenCalledOnce();
    bridge.stop();
  });

  it('releases resources if disconnect handling itself fails', async () => {
    const lifecycle = {
      _onEnter: vi.fn(),
      _onTelemetry: vi.fn(),
      _onSession: vi.fn(),
      _onDisconnect: vi.fn(() => {
        throw new Error('disconnect failed');
      }),
    };
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never,
      lifecycle as never
    );
    mockSdkState.sessionStatusOK = false;
    mockWaitForData.mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(40);

    expect(mockStopSDK).toHaveBeenCalledOnce();
    expect(offOverlayReady).toHaveBeenCalledOnce();
    expect(mockStopReporting).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    bridge.stop();
    expect(mockStopSDK).toHaveBeenCalledOnce();
  });

  it('cleans up failed initialization and preserves the original error', async () => {
    const error = new Error('SDK load failed');
    mockReady.mockRejectedValueOnce(error);
    mockStopSDK.mockImplementationOnce(() => {
      throw new Error('shutdown failed');
    });

    await expect(
      publishIRacingSDKEvents(createOverlayManager() as never)
    ).rejects.toBe(error);

    expect(mockStopSDK).toHaveBeenCalledOnce();
    expect(offOverlayReady).toHaveBeenCalledOnce();
    expect(mockStopReporting).toHaveBeenCalledOnce();
    expect(mockWaitForData).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops idempotently even if native shutdown throws, cancelling the pending retry', async () => {
    const bridge = await publishIRacingSDKEvents(
      createOverlayManager() as never
    );
    mockWaitForData.mockImplementationOnce(() => {
      throw new Error('native failed');
    });
    await vi.advanceTimersByTimeAsync(40);
    mockStopSDK.mockImplementationOnce(() => {
      throw new Error('shutdown failed');
    });
    const reads = mockWaitForData.mock.calls.length;

    expect(() => bridge.stop()).not.toThrow();
    bridge.stop();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(mockStopSDK).toHaveBeenCalledOnce();
    expect(offOverlayReady).toHaveBeenCalledOnce();
    expect(mockStopReporting).toHaveBeenCalledOnce();
    expect(mockWaitForData).toHaveBeenCalledTimes(reads);
    expect(vi.getTimerCount()).toBe(0);
  });
});
