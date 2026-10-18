import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelBus } from '../channelBus';
import type { Session } from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  waitForData: vi.fn(() => true),
  onFrame: vi.fn(),
  onSession: vi.fn(),
  dispose: vi.fn(),
}));
const session = { WeekendInfo: {} } as Session;
const telemetry = {
  SessionTime: { value: [42] },
};

vi.mock('../../irsdk', () => ({
  IRacingSDK: class {
    sessionStatusOK = true;
    currDataVersion = 1;
    ready = async () => true;
    waitForData = mocks.waitForData;
    getTelemetry = () => telemetry;
    getSessionData = () => session;
    stopSDK = vi.fn();
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
}));
vi.mock('../../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { publishIRacingSDKEvents } from './iracingSdkBridge';

describe('paused tape processor demand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('IRDASHIES_TELEMETRY_REPLAY', '/fixture.irdt');
    vi.clearAllMocks();
    mocks.waitForData.mockReturnValue(true);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('initializes session data before the destination frame and refreshes new demand once while paused', async () => {
    const bus = new ChannelBus();
    const bridge = await publishIRacingSDKEvents(
      {
        onOverlayReady: () => () => undefined,
        publishMessage: vi.fn(),
        publishMessageToOverlay: vi.fn(),
        hasTelemetryInspectorSubscribers: () => false,
      } as never,
      undefined,
      bus
    );
    expect(mocks.onSession).toHaveBeenCalledWith(session);
    expect(mocks.onFrame).toHaveBeenCalledWith(telemetry);
    expect(mocks.onSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.onFrame.mock.invocationCallOrder[0]
    );

    mocks.waitForData.mockReturnValue(false);
    const calls = mocks.onFrame.mock.calls.length;
    bus.subscribe(
      {
        id: 1,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'session-bar.snapshot'
    );
    await vi.advanceTimersByTimeAsync(80);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls + 1);
    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.onFrame).toHaveBeenCalledTimes(calls + 1);
    bridge.stop();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
