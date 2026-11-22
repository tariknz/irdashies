import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelBus } from '../channelBus';
import { TrackLocation } from '@irdashies/types';
import type {
  ChannelPayloads,
  PitLaneTrackData,
  PitStopEstimateSnapshot,
  PitStopModelFile,
  PitStopReport,
  ReferenceLap,
  Session,
  Telemetry,
} from '@irdashies/types';
import type { PitStopModelPersistence } from '../../storage/pitStopModel';
import type {
  ProcessorChannel,
  ProcessorDefinition,
  ProcessorFactoryContext,
} from '../../processors/ProcessorHost';
import type * as ProcessorRegistry from '../../processors/processorRegistry';

type HostOptions = Parameters<
  typeof ProcessorRegistry.createDefaultProcessorHost
>[0];

const mocks = vi.hoisted(() => {
  const host = { onFrame: vi.fn(), onSession: vi.fn(), dispose: vi.fn() };
  return {
    ...host,
    createHost: vi.fn<(options: HostOptions) => typeof host>(() => host),
    pitStopFile: {
      version: 1,
      transit: {},
      service: {},
      overrides: {},
      order: [],
    } as PitStopModelFile,
    addTransit: vi.fn<PitStopModelPersistence['addTransit']>(),
    addService: vi.fn<PitStopModelPersistence['addService']>(),
    pitLane: vi.fn<(trackId: string) => Promise<PitLaneTrackData | null>>(
      async () => ({ pitEntryPct: 0.9, pitExitPct: 0.05 })
    ),
    appendPitStopReport: vi.fn<(report: PitStopReport) => Promise<void>>(
      async () => undefined
    ),
    waitForData: vi.fn(() => true),
    ready: vi.fn(async () => true),
    stopSDK: vi.fn(),
    stopReporting: vi.fn(),
    sdkWaitEnabled: false,
    recordSdkWait: vi.fn(),
    offOverlayReady: vi.fn(),
    loadRadarPoleSideOverrides: vi.fn(async () => undefined),
    getTapeReplayStatus: vi.fn(() => ({ paused: true })),
  };
});
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
  createDefaultProcessorHost: mocks.createHost,
}));
vi.mock('../../storage/referenceLaps', () => ({
  getReferenceLap: vi.fn(),
  saveReferenceLap: vi.fn(),
}));
vi.mock('../../storage/radarTuning', () => ({ getRadarTuning: vi.fn() }));
vi.mock('../../storage/pitStopModel', () => ({
  getPitStopModelStore: (): PitStopModelPersistence => ({
    read: () => mocks.pitStopFile,
    addTransit: mocks.addTransit,
    addService: mocks.addService,
  }),
}));
vi.mock('../../storage/pitLaneData', () => ({
  getPitLaneDataForTrack: mocks.pitLane,
}));
vi.mock('../../storage/pitStopReports', () => ({
  appendPitStopReport: mocks.appendPitStopReport,
}));
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
    get sdkWaitEnabled() {
      return mocks.sdkWaitEnabled;
    }
    recordSdkWait = mocks.recordSdkWait;
  },
}));
vi.mock('../../perfRunConfig', () => ({
  getPerfRunConfig: () => ({ enabled: false }),
}));
vi.mock('../../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { publishIRacingSDKEvents } from './iracingSdkBridge';

async function startBridge(bus = new ChannelBus()) {
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
    mocks.sdkWaitEnabled = false;
    mocks.waitForData.mockReturnValue(true);
    mocks.ready.mockReset().mockResolvedValue(true);
    mocks.loadRadarPoleSideOverrides.mockReset().mockResolvedValue(undefined);
    mocks.stopSDK.mockReset();
    mocks.getTapeReplayStatus.mockReturnValue({ paused: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('records only native wait time and uses the scheduled poll rate', async () => {
    mocks.sdkWaitEnabled = true;
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mocks.waitForData.mockImplementation(() => {
      now += 3;
      return true;
    });
    const bus = new ChannelBus();
    const maxActiveRateHz = vi
      .spyOn(bus, 'maxActiveRateHz')
      .mockImplementation(() => {
        now += 5;
        return 60;
      });
    const { bridge } = await startBridge(bus);

    try {
      expect(mocks.recordSdkWait).toHaveBeenLastCalledWith(3, true, 16, 60);
      mocks.waitForData.mockImplementation(() => {
        now += 4;
        return false;
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(mocks.recordSdkWait).toHaveBeenLastCalledWith(4, false, 16, 25);
      expect(maxActiveRateHz).toHaveBeenCalledOnce();
    } finally {
      bridge.stop();
    }
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

describe('pit stop estimate during tape playback', () => {
  const raceSession = {
    WeekendInfo: {
      TrackID: 10,
      SeriesID: 1,
      TrackLength: '5.00 km',
      TrackPitSpeedLimit: '60.00 kph',
      BuildVersion: 'test',
    },
    DriverInfo: {
      DriverCarIdx: 0,
      DriverCarFuelMaxLtr: 100,
      DriverCarMaxFuelPct: 1,
      Drivers: [
        {
          CarIdx: 0,
          CarID: 20,
          CarClassID: 30,
          CarPath: 'car-a',
          CarClassEstLapTime: 100,
          CarIsPaceCar: 0,
          IsSpectator: 0,
        },
      ],
    },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  } as unknown as Session;

  const evenLap = (): ReferenceLap => {
    const points = 100;
    const pointPos = new Float32Array(points);
    const times = new Float32Array(points);
    for (let i = 0; i < points; i++) {
      pointPos[i] = i / points;
      times[i] = i;
    }
    return {
      pointPos,
      times,
      tangents: new Float32Array(points),
      interval: 0.01,
      pointsCount: points,
      startTime: 0,
      finishTime: 100,
      lastTrackedPct: 0.99,
      isCleanLap: true,
    };
  };

  const playerAt = (t: number) => {
    if (t < 40)
      return {
        pct: 0.5 + t * 0.01,
        pit: false,
        surface: TrackLocation.OnTrack,
      };
    if (t < 50)
      return {
        pct: 0.9 + (t - 40) * 0.005,
        pit: true,
        surface: TrackLocation.ApproachingPits,
      };
    if (t < 70)
      return { pct: 0.95, pit: true, surface: TrackLocation.InPitStall };
    if (t < 90)
      return {
        pct: (0.95 + (t - 70) * 0.005) % 1,
        pit: true,
        surface: TrackLocation.ApproachingPits,
      };
    return {
      pct: (0.05 + (t - 90) * 0.01) % 1,
      pit: false,
      surface: TrackLocation.OnTrack,
    };
  };

  const frameAt = (t: number): Telemetry => {
    const player = playerAt(t);
    return {
      SessionTime: { value: [t] },
      SessionNum: { value: [0] },
      Gear: { value: [1] },
      CarIdxLap: { value: [3] },
      SessionFlags: { value: [0] },
      IsOnTrack: { value: [true] },
      CarIdxLapDistPct: { value: [player.pct] },
      CarIdxOnPitRoad: { value: [player.pit] },
      CarIdxTrackSurface: { value: [player.surface] },
      PitstopActive: { value: [player.surface === TrackLocation.InPitStall] },
      FuelLevel: { value: [t < 52 ? 20 : t < 68 ? 20 + 2.5 * (t - 52) : 60] },
      PitSvFlags: { value: [0x1f] },
      PitSvFuel: { value: [60] },
      PitRepairLeft: { value: [0] },
      PlayerCarTowTime: { value: [0] },
    } as unknown as Telemetry;
  };

  const runStop = async (aggregateReplay: boolean) => {
    const { bridge } = await startBridge();
    bridge.stop();
    const options = mocks.createHost.mock.calls[0][0];
    expect(options.aggregateReplay).toBe(true);
    const registry = await vi.importActual<typeof ProcessorRegistry>(
      '../../processors/processorRegistry'
    );
    const definition = registry
      .createProcessorDefinitions(options)
      .find(
        (entry): entry is ProcessorDefinition<'pit-stop-estimate.snapshot'> =>
          entry.channel === 'pit-stop-estimate.snapshot'
      );
    const context: ProcessorFactoryContext = {
      aggregateReplay,
      sourceReplay: false,
      snapshot: <K extends ProcessorChannel>(channel: K) =>
        (channel === 'reference-laps.snapshot'
          ? {
              bestLaps: [],
              persistedLaps: [[30, evenLap()]],
              sessionNum: 0,
              version: 1,
            }
          : undefined) as ChannelPayloads[K] | undefined,
    };
    const processor = definition?.create(context);
    if (!processor) throw new Error('pit stop estimate is not registered');
    processor.onLifecycle({ type: 'enter', replay: false });
    processor.init(raceSession);
    await vi.advanceTimersByTimeAsync(0);

    const states = new Set<PitStopEstimateSnapshot['state']>();
    let offsetSeen = false;
    for (let i = 0; i <= 1100; i++) {
      processor.onFrame(frameAt(i / 10));
      const snapshot = processor.snapshot();
      states.add(snapshot.state);
      offsetSeen ||= snapshot.offsetPct !== null;
    }
    return { states, offsetSeen };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('IRDASHIES_TELEMETRY_REPLAY', '/fixture.irdt');
    vi.clearAllMocks();
    mocks.waitForData.mockReturnValue(true);
    mocks.ready.mockReset().mockResolvedValue(true);
    mocks.loadRadarPoleSideOverrides.mockReset().mockResolvedValue(undefined);
    mocks.getTapeReplayStatus.mockReturnValue({ paused: true });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('publishes an estimate and learns in memory without saving reports', async () => {
    const { states, offsetSeen } = await runStop(true);

    expect(mocks.pitLane).toHaveBeenCalledWith('10');
    expect(states.has('calibrating')).toBe(true);
    expect(offsetSeen).toBe(true);
    expect(mocks.appendPitStopReport).not.toHaveBeenCalled();
    expect(mocks.addTransit).not.toHaveBeenCalled();
    expect(mocks.addService).not.toHaveBeenCalled();
  });

  it('saves the report for the same stop outside tape playback', async () => {
    await runStop(false);

    expect(mocks.appendPitStopReport).toHaveBeenCalledOnce();
    expect(mocks.addService).toHaveBeenCalledOnce();
  });
});
