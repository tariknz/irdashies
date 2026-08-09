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
import { createDefaultProcessorHost } from '../../processors/processorRegistry';

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

  const perfMetrics = new TelemetryPerfMetrics(undefined, channelBus);
  perfMetrics.startReporting();
  const referenceLapStorage = channelBus
    ? await import('../../storage/referenceLaps')
    : undefined;
  const processorHost =
    channelBus && referenceLapStorage
      ? createDefaultProcessorHost({
          bus: channelBus,
          lifecycle,
          metrics: perfMetrics,
          aggregateReplay: isTapeReplay,
          referenceLapPersistence: {
            load: referenceLapStorage.getReferenceLap,
            save: referenceLapStorage.saveReferenceLap,
          },
        })
      : undefined;

  let shouldStop = false;
  let lastRunningState: boolean | undefined = undefined;
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
          perfMetrics.markStart('lifecycleTelemetry');
          lifecycle?._onTelemetry(telemetry);
          perfMetrics.markEnd('lifecycleTelemetry');
          processorHost?.onFrame(telemetry);
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
          // Session YAML is large. Publish it only when the SDK revision changes;
          // late subscribers are seeded from latestSession below.
          if (sdk.currDataVersion !== lastSessionVersion) {
            perfMetrics.markStart('sessionPublish');
            lastSessionVersion = sdk.currDataVersion;
            latestSession = session;
            lifecycle?._onSession(session);
            processorHost?.onSession(session);
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
        latestSession = null;
        overlayManager.clearLatestSessionData?.();
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
      if (latestSession) callback(latestSession);
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
      overlayManager.clearLatestSessionData?.();
      sdk.stopSDK();
      clearInterval(runningStateInterval);
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
      processorHost?.dispose();
      perfMetrics.stopReporting();
    },
  };
}
