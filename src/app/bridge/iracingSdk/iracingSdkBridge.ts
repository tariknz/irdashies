import { IRacingSDK } from '../../irsdk';
import { OverlayManager } from '../../overlayManager';
import { TelemetryPerfMetrics } from '../../perfMetrics';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';

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
  'RadioTransmitCarIdx',
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

// Short timeout for waitForData to avoid blocking the main thread.
// The native SDK's WaitForSingleObject blocks synchronously, so keep this
// small to keep the event loop responsive.
const WAIT_TIMEOUT = 16;
// How long to sleep between connection retry attempts when iRacing isn't running.
const RETRY_INTERVAL = 1000;

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle
): Promise<IrSdkBridge> {
  logger.info('[iracingSdkBridge] Loading iRacing SDK bridge...');

  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

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
    if (latestTelemetry)
      overlayManager.publishMessageToOverlay(
        id,
        'telemetry',
        trimTelemetry(latestTelemetry)
      );
    if (latestSession)
      overlayManager.publishMessageToOverlay(id, 'sessionData', latestSession);
  });

  const sdk = new IRacingSDK();
  sdk.autoEnableTelemetry = true;
  await sdk.ready();

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
      let lastSessionPublishTime = 0;
      let wasRunning = false;

      while (!shouldStop && sdk.waitForData(WAIT_TIMEOUT)) {
        if (!wasRunning) {
          logger.info('[iracingSdkBridge] iRacing is running');
          wasRunning = true;
        }
        perfMetrics.markStart('processTelemetry');
        const telemetry = sdk.getTelemetry();
        const session = sdk.getSessionData();

        if (telemetry) {
          latestTelemetry = telemetry;
          lifecycle?._onTelemetry(telemetry);
          perfMetrics.markStart('broadcast');
          overlayManager.publishMessage('telemetry', trimTelemetry(telemetry));
          perfMetrics.markEnd('broadcast');
          telemetryCallbacks.forEach((callback) => callback(telemetry));
        }

        if (session) {
          // Only publish the session data if it has changed or if 1 second has passed since the last publish
          const now = Date.now();
          const timeSinceLastPublish = now - lastSessionPublishTime;
          if (
            sdk.currDataVersion !== lastSessionVersion ||
            timeSinceLastPublish >= 1000
          ) {
            lastSessionVersion = sdk.currDataVersion;
            lastSessionPublishTime = now;
            latestSession = session;
            lifecycle?._onSession(session);
            overlayManager.publishMessage('sessionData', session);
            sessionCallbacks.forEach((callback) => callback(session));
          }
        }
        perfMetrics.markEnd('processTelemetry');
        perfMetrics.tick();

        // Throttling to ~25Hz to save system resources as requested.
        // We sleep AFTER publishing to ensure each frame is sent with minimal latency.
        await new Promise((resolve) => setTimeout(resolve, 1000 / 25));
      }

      if (wasRunning) {
        logger.info(
          '[iracingSdkBridge] iRacing is no longer publishing telemetry'
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
      clearInterval(runningStateInterval);
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
      perfMetrics.stopReporting();
    },
  };
}
