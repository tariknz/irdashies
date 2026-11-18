import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelBus } from '../channelBus';
import type { Session } from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  waitForData: vi.fn(() => true),
  ready: vi.fn(async () => true),
  stopSDK: vi.fn(),
  stopReporting: vi.fn(),
  offOverlayReady: vi.fn(),
  loadRadarPoleSideOverrides: vi.fn(async () => undefined),
  onFrame: vi.fn(),
  onSession: vi.fn(),
  dispose: vi.fn(),
  getTapeReplayStatus: vi.fn(() => ({ paused: true })),
}));
const session = { WeekendInfo: {} } as Session;
const telemetry = {
  SessionTime: { value: [42] },
};

vi.mock('../../irsdk', () => ({
  IRacingSDK: class {
    sessionStatusOK = true;
    currDataVersion = 1;
    ready = mocks.ready;
    waitForData = mocks.waitForData;
    getTelemetry = () => telemetry;
    getSessionData = () => session;
    getTapeReplayStatus = mocks.getTapeReplayStatus;
    stopSDK = mocks.stopSDK;
  },
}));
vi.mock('../../processors/processorRegistry', () => ({
  createDefaultProcessorHost: () => ({
    onFrame: mocks.onFrame,
    onSession: mocks.onSession,
    dispose: mocks.dispose,
  }),
}));
vi.mock('../../storage/referenceLaps', () => ({
  getReferenceLap: vi.fn(),
  saveReferenceLap: vi.fn(),
}));
vi.mock('../../storage/radarTuning', () => ({ getRadarTuning: vi.fn() }));
vi.mock('../../storage/radarPoleSideOverrides', () => ({
  radarPoleSideOverrides: {},
  loadRadarPoleSideOverrides: mocks.loadRadarPoleSideOverrides,
}));
vi.mock('../../storage/racePlanHistory', () => ({
  getRacePlanHistoryStore: () => ({
    load: vi.fn(async () => undefined),
    get: vi.fn(() => null),
    save: vi.fn(),
    flush: vi.fn(async () => undefined),
  }),
}));
vi.mock('../../perfMetrics', () => ({
  TelemetryPerfMetrics: class {
    startReporting = vi.fn();
    stopReporting = mocks.stopReporting;
    markStart = vi.fn();
    markEnd = vi.fn();
    tick = vi.fn();
  },
}));
vi.mock('../../perfRunConfig', () => ({
  getPerfRunConfig: () => ({ enabled: false }),
}));
vi.mock('../../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { publishIRacingSDKEvents } from './iracingSdkBridge';

async function startBridge() {
  const bus = new ChannelBus();
  const bridge = await publishIRacingSDKEvents(
    {
      onOverlayReady: () => mocks.offOverlayReady,
      publishMessage: vi.fn(),
      publishMessageToOverlay: vi.fn(),
      hasTelemetryInspectorSubscribers: () => false,
    } as never,
    undefined,
    bus
  );
  return { bus, bridge };
}

function subscribe(bus: ChannelBus) {
  bus.subscribe(
    {
      id: 1,
      isDestroyed: () => false,
      isVisible: () => true,
      send: vi.fn(),
    },
    'session-bar.snapshot'
  );
}

describe('paused tape processor demand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('IRDASHIES_TELEMETRY_REPLAY', '/fixture.irdt');
    vi.clearAllMocks();
    mocks.waitForData.mockReturnValue(true);
    mocks.ready.mockReset().mockResolvedValue(true);
    mocks.loadRadarPoleSideOverrides.mockReset().mockResolvedValue(undefined);
    mocks.stopSDK.mockReset();
    mocks.getTapeReplayStatus.mockReturnValue({ paused: true });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('initializes session data before the destination frame and refreshes new demand once while paused', async () => {
    const { bus, bridge } = await startBridge();
    expect(mocks.onSession).toHaveBeenCalledWith(session);
    expect(mocks.onFrame).toHaveBeenCalledWith(telemetry);
    expect(mocks.onSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.onFrame.mock.invocationCallOrder[0]
    );

    mocks.waitForData.mockReturnValue(false);
    const calls = mocks.onFrame.mock.calls.length;
    subscribe(bus);
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls + 1);
    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls + 1);
    bridge.stop();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const framesAtStop = mocks.onFrame.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(mocks.onFrame).toHaveBeenCalledTimes(framesAtStop);
  });

  it('discards pending demand during active playback without replaying it when playback pauses', async () => {
    const { bus, bridge } = await startBridge();
    mocks.getTapeReplayStatus.mockReturnValue({ paused: false });
    mocks.waitForData.mockReturnValue(false);
    const calls = mocks.onFrame.mock.calls.length;
    subscribe(bus);
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls);
    expect(mocks.getTapeReplayStatus).toHaveBeenCalledOnce();

    mocks.getTapeReplayStatus.mockReturnValue({ paused: true });
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls);
    expect(mocks.getTapeReplayStatus).toHaveBeenCalledOnce();
    bridge.stop();
  });

  it('lets a new destination frame satisfy pending demand while paused', async () => {
    const { bus, bridge } = await startBridge();
    const calls = mocks.onFrame.mock.calls.length;
    subscribe(bus);
    mocks.waitForData.mockReturnValueOnce(true).mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls + 1);
    expect(mocks.getTapeReplayStatus).not.toHaveBeenCalled();
    bridge.stop();
  });

  it('does not poll replay status or refresh frames for live subscriber demand', async () => {
    vi.stubEnv('IRDASHIES_TELEMETRY_REPLAY', '');
    const { bus, bridge } = await startBridge();
    mocks.waitForData.mockReturnValue(false);
    const calls = mocks.onFrame.mock.calls.length;
    subscribe(bus);
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls);
    expect(mocks.getTapeReplayStatus).not.toHaveBeenCalled();
    bridge.stop();
  });

  it('releases the processor host and replay-demand listener if SDK readiness fails', async () => {
    const bus = new ChannelBus();
    const offDemand = vi.fn();
    vi.spyOn(bus, 'onSubscriberCountChanged').mockReturnValue(offDemand);
    const failure = new Error('SDK readiness failed');
    mocks.ready.mockRejectedValueOnce(failure);
    mocks.stopSDK.mockImplementationOnce(() => {
      throw new Error('stop failed');
    });

    await expect(
      publishIRacingSDKEvents(
        {
          onOverlayReady: () => mocks.offOverlayReady,
          publishMessage: vi.fn(),
          clearLatestSessionData: vi.fn(),
        } as never,
        undefined,
        bus
      )
    ).rejects.toBe(failure);

    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(offDemand).toHaveBeenCalledOnce();
    expect(mocks.offOverlayReady).toHaveBeenCalledOnce();
    expect(mocks.stopReporting).toHaveBeenCalledOnce();
    expect(mocks.stopSDK).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops perf reporting when storage initialization rejects before SDK creation', async () => {
    const failure = new Error('storage failed');
    mocks.loadRadarPoleSideOverrides.mockRejectedValueOnce(failure);

    await expect(startBridge()).rejects.toBe(failure);

    expect(mocks.stopReporting).toHaveBeenCalledOnce();
    expect(mocks.ready).not.toHaveBeenCalled();
    expect(mocks.offOverlayReady).not.toHaveBeenCalled();
    expect(mocks.dispose).not.toHaveBeenCalled();
  });
});
