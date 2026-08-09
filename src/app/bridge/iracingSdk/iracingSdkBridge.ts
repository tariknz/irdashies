import { IRacingSDK } from '../../irsdk';
import { OverlayManager } from '../../overlayManager';
import { TelemetryPerfMetrics } from '../../perfMetrics';
import {
  getPerfRunConfig,
  PERF_REPLAY_READY_LOG_MARKER,
} from '../../perfRunConfig';
import {
  TELEMETRY_INSPECTOR_RATE_HZ,
  type IrSdkSourceBridge,
  type Session,
  type Telemetry,
} from '@irdashies/types';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { FuelProjectionRuntime } from '../../processors/fuelProjectionRuntime';
import { LapTimesRuntime } from '../../processors/lapTimesRuntime';
import { CarSpeedsRuntime } from '../../processors/carSpeedsRuntime';
import { ReferenceLapRuntime } from '../../processors/referenceLapRuntime';
import { RelativeGapRuntime } from '../../processors/relativeGapRuntime';
import { SectorTimingRuntime } from '../../processors/sectorTimingRuntime';
import { StandingsRuntime } from '../../processors/standingsRuntime';
import { RadioRuntime } from '../../processors/radioRuntime';
import { SessionTimingRuntime } from '../../processors/sessionTimingRuntime';
import { SessionBarRuntime } from '../../processors/sessionBarRuntime';
import { DriverControlsRuntime } from '../../processors/driverControlsRuntime';
import { TrackStateRuntime } from '../../processors/trackStateRuntime';
import { LapLogRuntime } from '../../processors/lapLogRuntime';

// Keys consumed by the renderer. Anything outside this set is dropped before
// the telemetry object crosses the IPC boundary — reducing structured-clone
// payload from ~340 keys to ~60 and cutting IPC fanout cost (finding P1).
const TELEMETRY_ALLOWLIST = new Set<keyof Telemetry>([
  'AirTemp',
  'BrakeABSactive',
  'Brake',
  'BrakeRaw',
  'CamCarIdx',
  'CarIdxBestLapTime',
  'CarIdxClass',
  'CarIdxClassPosition',
  'CarIdxEstTime',
  'CarIdxF2Time',
  'CarIdxLap',
  'CarIdxLapCompleted',
  'CarIdxLapDistPct',
  'CarIdxLastLapTime',
  'CarIdxOnPitRoad',
  'CarIdxP2P_Count',
  'CarIdxP2P_Status',
  'CarIdxPosition',
  'CarIdxSessionFlags',
  'CarIdxTireCompound',
  'CarIdxTrackSurface',
  'CarLeftRight',
  'Clutch',
  'ClutchRaw',
  'DisplayUnits',
  'EngineWarnings',
  'FuelLevel',
  'FuelLevelPct',
  'Gear',
  'IsGarageVisible',
  'IsInGarage',
  'IsOnTrack',
  'IsReplayPlaying',
  'Lap',
  'LapBestLapTime',
  'LapCompleted',
  'LapCurrentLapTime',
  'LapDistPct',
  'LapLastLapTime',
  'OnPitRoad',
  'OilTemp',
  'WaterTemp',
  'PitstopActive',
  'PlayerCarInPitStall',
  'PlayerCarMyIncidentCount',
  'PlayerCarTeamIncidentCount',
  'PlayerCarTowTime',
  'PlayerTrackSurface',
  'LapDeltaToSessionBestLap',
  'LapDeltaToSessionBestLap_OK',
  'LapDeltaToSessionLastlLap',
  'LapDeltaToSessionLastlLap_OK',
  'Precipitation',
  'RPM',
  'RelativeHumidity',
  'ReplayFrameNum',
  'SessionFlags',
  'SessionLapsRemain',
  'SessionNum',
  'SessionState',
  'SessionTime',
  'SessionTimeOfDay',
  'SessionTimeRemain',
  'SessionTimeTotal',
  'SessionUniqueID',
  'ShiftGrindRPM',
  'Speed',
  'SteeringWheelAngle',
  'Throttle',
  'ThrottleRaw',
  'TrackTempCrew',
  'TrackWetness',
  'WindDir',
  'WindVel',
  'YawNorth',
  'dcBrakeBias',
  'dcPeakBrakeBias',
  'dcPitSpeedLimiterToggle',
]);

function trimTelemetry(telemetry: Telemetry): Partial<Telemetry> {
  const trimmed: Partial<Telemetry> = {};
  for (const key of TELEMETRY_ALLOWLIST) {
    if (key in telemetry) {
      (trimmed as Record<string, unknown>)[key] = (
        telemetry as Record<string, unknown>
      )[key];
    }
  }
  return trimmed;
}

const perfRunConfig = getPerfRunConfig();
const perfTelemetryDeliveryEnabled =
  !perfRunConfig.enabled || perfRunConfig.telemetryDelivery === 'on';
const perfRawTelemetryEnabled =
  perfRunConfig.enabled && perfRunConfig.telemetryPayload === 'raw';

function telemetryForRenderer(
  telemetry: Telemetry
): Telemetry | Partial<Telemetry> {
  return perfRawTelemetryEnabled ? telemetry : trimTelemetry(telemetry);
}

// Short timeout for waitForData to avoid blocking the main thread.
// The native SDK's WaitForSingleObject blocks synchronously, so keep this
// small to keep the event loop responsive.
const WAIT_TIMEOUT = 16;
// How long to sleep between connection retry attempts when iRacing isn't running.
const RETRY_INTERVAL = 1000;
// How often to ask the SDK for session data. The native getSessionData() copies
// and transcodes the whole session YAML on every call even when nothing has
// changed, and currDataVersion only refreshes as a side effect of that call, so
// there is no cheap way to check first. Polling at 2 Hz bounds session-change
// detection latency to about 500 ms while avoiding work on every telemetry tick.
const SESSION_POLL_INTERVAL = 500;

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  logger.info('[iracingSdkBridge] Loading iRacing SDK bridge...');
  const isTapeReplay = Boolean(process.env.IRDASHIES_TELEMETRY_REPLAY);
  const sourceName = isTapeReplay ? 'telemetry replay' : 'iRacing';

  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();
  const fuelProjectionRuntime =
    lifecycle && channelBus
      ? new FuelProjectionRuntime(channelBus, lifecycle, perfMetrics, {
          aggregateReplay: isTapeReplay,
        })
      : undefined;
  const lapTimesRuntime =
    lifecycle && channelBus
      ? new LapTimesRuntime(channelBus, lifecycle, perfMetrics, isTapeReplay)
      : undefined;
  const carSpeedsRuntime =
    lifecycle && channelBus
      ? new CarSpeedsRuntime(channelBus, lifecycle, perfMetrics, isTapeReplay)
      : undefined;
  const referenceLapStorage =
    lifecycle && channelBus
      ? await import('../../storage/referenceLaps')
      : undefined;
  const referenceLapRuntime =
    lifecycle && channelBus && referenceLapStorage
      ? new ReferenceLapRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          {
            load: referenceLapStorage.getReferenceLap,
            save: referenceLapStorage.saveReferenceLap,
          },
          isTapeReplay
        )
      : undefined;
  const relativeGapRuntime =
    lifecycle && channelBus && referenceLapRuntime
      ? new RelativeGapRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          referenceLapRuntime,
          isTapeReplay
        )
      : undefined;
  const sectorTimingRuntime =
    lifecycle && channelBus
      ? new SectorTimingRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          isTapeReplay
        )
      : undefined;
  const standingsRuntime =
    lifecycle && channelBus
      ? new StandingsRuntime(channelBus, lifecycle, perfMetrics, isTapeReplay)
      : undefined;
  const radioRuntime =
    lifecycle && channelBus
      ? new RadioRuntime(channelBus, lifecycle, perfMetrics, isTapeReplay)
      : undefined;
  const sessionTimingRuntime =
    lifecycle && channelBus && lapTimesRuntime
      ? new SessionTimingRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          lapTimesRuntime,
          isTapeReplay
        )
      : undefined;
  const sessionBarRuntime = channelBus
    ? new SessionBarRuntime(channelBus, lifecycle, perfMetrics, isTapeReplay)
    : undefined;
  const driverControlsRuntime = channelBus
    ? new DriverControlsRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const trackStateRuntime = channelBus
    ? new TrackStateRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const lapLogRuntime = channelBus
    ? new LapLogRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;

  let shouldStop = false;
  let lastRunningState: boolean | undefined = undefined;
  let latestTelemetry: Telemetry | null = null;
  let latestSession: Session | null = null;

  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

  overlayManager.onOverlayReady((id) => {
    logger.info(
      '[iracingSdkBridge] New window ready, sending initial data: ',
      id
    );
    if (lastRunningState !== undefined)
      overlayManager.publishMessageToOverlay(
        id,
        'runningState',
        lastRunningState
      );
    if (latestTelemetry && perfTelemetryDeliveryEnabled)
      overlayManager.publishMessageToOverlay(
        id,
        'telemetryInspector:telemetry',
        telemetryForRenderer(latestTelemetry)
      );
    if (latestSession)
      overlayManager.publishMessageToOverlay(id, 'sessionData', latestSession);
  });

  const sdk = new IRacingSDK();
  sdk.autoEnableTelemetry = true;
  await sdk.ready();
  if (
    perfRunConfig.enabled &&
    (process.env.IRDASHIES_IRSDK_REPLAY === '1' || isTapeReplay)
  ) {
    logger.info(PERF_REPLAY_READY_LOG_MARKER);
  }

  // Seed the running state immediately so the renderer doesn't sit on the
  // previous bridge's last value (e.g. a stale demo frame) until the first
  // interval tick 5s later — this is what made exiting demo mode feel slow.
  const initialRunningState = sdk.sessionStatusOK;
  lastRunningState = initialRunningState;
  overlayManager.publishMessage('runningState', initialRunningState);
  runningStateCallbacks.forEach((callback) => callback(initialRunningState));

  const runningStateInterval = setInterval(() => {
    const isSimRunning = sdk.sessionStatusOK;
    if (isSimRunning === lastRunningState) {
      return;
    }
    lastRunningState = isSimRunning;
    logger.info(
      '[iracingSdkBridge] Sending running state to window',
      isSimRunning
    );
    overlayManager.publishMessage('runningState', isSimRunning);
    runningStateCallbacks.forEach((callback) => callback(isSimRunning));
  }, 5000);

  // Start the telemetry loop in the background
  (async () => {
    while (!shouldStop) {
      let lastSessionVersion = -1;
      let lastInspectorTelemetryPublishTime = Number.NEGATIVE_INFINITY;
      // Negative infinity makes the first tick fetch and publish immediately.
      let lastSessionPublishTime = Number.NEGATIVE_INFINITY;
      let lastSessionPollTime = Number.NEGATIVE_INFINITY;
      let wasRunning = false;

      while (!shouldStop && sdk.waitForData(WAIT_TIMEOUT)) {
        if (!wasRunning) {
          logger.info(`[iracingSdkBridge] ${sourceName} is running`);
          wasRunning = true;
          lifecycle?._onEnter({ replay: isTapeReplay });
        }
        perfMetrics.markStart('processTelemetry');
        perfMetrics.markStart('sdkTelemetryRead');
        const telemetry = sdk.getTelemetry();
        perfMetrics.markEnd('sdkTelemetryRead');
        const tickTime = performance.now();
        let session: Session | null = null;
        if (tickTime - lastSessionPollTime >= SESSION_POLL_INTERVAL) {
          lastSessionPollTime = tickTime;
          perfMetrics.markStart('sdkSessionRead');
          session = sdk.getSessionData();
          perfMetrics.markEnd('sdkSessionRead');
        }

        if (telemetry) {
          latestTelemetry = telemetry;
          perfMetrics.markStart('lifecycleTelemetry');
          lifecycle?._onTelemetry(telemetry);
          perfMetrics.markEnd('lifecycleTelemetry');
          fuelProjectionRuntime?.onFrame(telemetry);
          lapTimesRuntime?.onFrame(telemetry);
          carSpeedsRuntime?.onFrame(telemetry);
          referenceLapRuntime?.onFrame(telemetry);
          relativeGapRuntime?.onFrame(telemetry);
          sectorTimingRuntime?.onFrame(telemetry);
          standingsRuntime?.onFrame(telemetry);
          radioRuntime?.onFrame(telemetry);
          sessionTimingRuntime?.onFrame(telemetry);
          sessionBarRuntime?.onFrame(telemetry);
          driverControlsRuntime?.onFrame(telemetry);
          trackStateRuntime?.onFrame(telemetry);
          lapLogRuntime?.onFrame(telemetry);
          if (
            perfTelemetryDeliveryEnabled &&
            overlayManager.hasTelemetryInspectorSubscribers() &&
            tickTime - lastInspectorTelemetryPublishTime >=
              1000 / TELEMETRY_INSPECTOR_RATE_HZ
          ) {
            lastInspectorTelemetryPublishTime = tickTime;
            perfMetrics.markStart('telemetryProjection');
            const rendererTelemetry = telemetryForRenderer(telemetry);
            perfMetrics.markEnd('telemetryProjection');
            perfMetrics.markStart('broadcast');
            overlayManager.publishMessage(
              'telemetryInspector:telemetry',
              rendererTelemetry
            );
            perfMetrics.markEnd('broadcast');
          }
          perfMetrics.markStart('telemetryCallbacks');
          telemetryCallbacks.forEach((callback) => callback(telemetry));
          perfMetrics.markEnd('telemetryCallbacks');
        }

        if (session) {
          // Publish changes at the next poll and refresh unchanged data at 1 Hz.
          const timeSinceLastPublish = tickTime - lastSessionPublishTime;
          if (
            sdk.currDataVersion !== lastSessionVersion ||
            timeSinceLastPublish >= 1000
          ) {
            perfMetrics.markStart('sessionPublish');
            lastSessionVersion = sdk.currDataVersion;
            lastSessionPublishTime = tickTime;
            latestSession = session;
            lifecycle?._onSession(session);
            fuelProjectionRuntime?.onSession(session);
            carSpeedsRuntime?.onSession(session);
            referenceLapRuntime?.onSession(session);
            relativeGapRuntime?.onSession(session);
            sectorTimingRuntime?.onSession(session);
            standingsRuntime?.onSession(session);
            sessionTimingRuntime?.onSession(session);
            sessionBarRuntime?.onSession(session);
            driverControlsRuntime?.onSession(session);
            trackStateRuntime?.onSession(session);
            lapLogRuntime?.onSession(session);
            overlayManager.publishMessage('sessionData', session);
            sessionCallbacks.forEach((callback) => callback(session));
            perfMetrics.markEnd('sessionPublish');
          }
        }
        perfMetrics.markEnd('processTelemetry');
        perfMetrics.tick(telemetry);

        // Throttling to ~25Hz to save system resources as requested.
        // We sleep AFTER publishing to ensure each frame is sent with minimal latency.
        await new Promise((resolve) => setTimeout(resolve, 1000 / 25));
      }

      if (wasRunning) {
        logger.info(
          `[iracingSdkBridge] ${sourceName} is no longer publishing telemetry`
        );
        // Release the last telemetry/session snapshots so new overlay windows
        // opened during a disconnect don't get re-seeded with stale data, and
        // so the references don't sit in main-process memory indefinitely.
        // They get repopulated on the next successful waitForData tick.
        latestTelemetry = null;
        latestSession = null;
        lifecycle?._onDisconnect();
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }
  })();

  return {
    onTelemetry: (callback: (value: Telemetry) => void) => {
      telemetryCallbacks.add(callback);
      return () => {
        telemetryCallbacks.delete(callback);
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      sessionCallbacks.add(callback);
      return () => {
        sessionCallbacks.delete(callback);
      };
    },
    onRunningState: (callback: (value: boolean) => void) => {
      runningStateCallbacks.add(callback);
      return () => {
        runningStateCallbacks.delete(callback);
      };
    },
    stop: () => {
      shouldStop = true;
      sdk.stopSDK();
      clearInterval(runningStateInterval);
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
      fuelProjectionRuntime?.dispose();
      lapTimesRuntime?.dispose();
      carSpeedsRuntime?.dispose();
      relativeGapRuntime?.dispose();
      sectorTimingRuntime?.dispose();
      standingsRuntime?.dispose();
      radioRuntime?.dispose();
      sessionTimingRuntime?.dispose();
      sessionBarRuntime?.dispose();
      driverControlsRuntime?.dispose();
      trackStateRuntime?.dispose();
      lapLogRuntime?.dispose();
      referenceLapRuntime?.dispose();
      perfMetrics.stopReporting();
    },
  };
}
