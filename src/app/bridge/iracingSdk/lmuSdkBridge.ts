import { OverlayManager } from '../../overlayManager';
import { TelemetryPerfMetrics } from '../../perfMetrics';
import { getPerfRunConfig } from '../../perfRunConfig';
import {
  TELEMETRY_INSPECTOR_RATE_HZ,
  type IrSdkSourceBridge,
  type LmuTrackMap,
  type Session,
  type Telemetry,
} from '@irdashies/types';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { createDefaultProcessorHost } from '../../processors/processorRegistry';
import { mapLmuSession } from '../../irsdk/lmu/mapSession';
import { lmuSessionSignature } from '../../irsdk/lmu/sessionSignature';
import {
  mapLmuCarLeftRight,
  mapLmuTelemetry,
} from '../../irsdk/lmu/mapTelemetry';
import {
  findTinyPedalTrackMap,
  LmuTrackMapRecorder,
  LmuTrackMapStorage,
  tinyPedalTrackMapDirectories,
} from '../../irsdk/lmu/trackMap';
import { app } from 'electron';
import path from 'node:path';

// Poll cadence for the LMU shared-memory frame. LMU writes at the sim's
// physics rate (~60 Hz); a fixed 16 ms poll keeps latency low without burning
// CPU waiting between frames.
const TELEMETRY_POLL_INTERVAL = 16;
// Session snapshots are rebuilt from shared memory on demand; 2 Hz is plenty
// for driver-grid changes and mirrors the iRacing bridge's session poll rate.
const SESSION_POLL_INTERVAL = 500;
// How often to re-check the shared-memory map's existence when LMU is closed.
const RETRY_INTERVAL = 1000;
const perfRunConfig = getPerfRunConfig();
const perfTelemetryDeliveryEnabled =
  !perfRunConfig.enabled || perfRunConfig.telemetryDelivery === 'on';

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  logger.info(
    '[lmuSdkBridge] Loading Le Mans Ultimate shared-memory bridge...'
  );
  const { NativeLmu } = await import('../../irsdk/native/lmu');
  const sdk = new NativeLmu();
  const mapRecorder = new LmuTrackMapRecorder();
  const mapStorage = new LmuTrackMapStorage(
    path.join(app.getPath('userData'), 'lmu-track-maps.json')
  );

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
          aggregateReplay: false,
          logError: (message, error) => logger.error(message, error),
          referenceLapPersistence: {
            load: referenceLapStorage.getReferenceLap,
            save: referenceLapStorage.saveReferenceLap,
          },
        })
      : undefined;

  let shouldStop = false;
  let lastRunningState: boolean | undefined = undefined;
  let latestSession: Session | null = null;
  let lastSessionSignature: string | null = null;
  let activeTrackName = '';
  let trackMap: LmuTrackMap | null = null;
  let lastBlindSpotDataIssue: string | null | undefined;

  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

  const publishRunningState = (isSimRunning: boolean) => {
    if (isSimRunning === lastRunningState) return;
    lastRunningState = isSimRunning;
    logger.info('[lmuSdkBridge] Sending running state to window', isSimRunning);
    overlayManager.publishMessage('runningState', isSimRunning);
    runningStateCallbacks.forEach((callback) => callback(isSimRunning));
  };

  overlayManager.onOverlayReady((id) => {
    if (lastRunningState !== undefined)
      overlayManager.publishMessageToOverlay(
        id,
        'runningState',
        lastRunningState
      );
    if (latestSession)
      overlayManager.publishMessageToOverlay(id, 'sessionData', latestSession);
  });

  // Try to connect to the shared-memory map immediately so the renderer isn't
  // left on a stale running state while LMU loads.
  sdk.start();
  const initialRunningState = sdk.isRunning();
  lastRunningState = initialRunningState;
  overlayManager.publishMessage('runningState', initialRunningState);

  (async () => {
    let lastInspectorTelemetryPublishTime = Number.NEGATIVE_INFINITY;
    let lastSessionPollTime = Number.NEGATIVE_INFINITY;
    let wasRunning = false;

    while (!shouldStop) {
      const pollStartedAt = performance.now();
      const shouldPollSession =
        pollStartedAt - lastSessionPollTime >= SESSION_POLL_INTERVAL;
      perfMetrics.markStart('processTelemetry');
      perfMetrics.markStart(
        shouldPollSession ? 'sdkSessionRead' : 'sdkTelemetryRead'
      );
      const rawSession = shouldPollSession ? sdk.readSession() : null;
      const raw = rawSession ?? sdk.read();
      perfMetrics.markEnd(
        shouldPollSession ? 'sdkSessionRead' : 'sdkTelemetryRead'
      );
      if (!raw.running) {
        perfMetrics.markEnd('processTelemetry');
        if (wasRunning) {
          logger.info('[lmuSdkBridge] LMU no longer publishing telemetry');
          publishRunningState(false);
          latestSession = null;
          overlayManager.clearLatestSessionData?.();
          lifecycle?._onDisconnect();
          wasRunning = false;
          lastSessionSignature = null;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
        if (shouldStop) break;
        sdk.start();
        continue;
      }

      if (raw.trackName !== activeTrackName) {
        activeTrackName = raw.trackName;
        trackMap = mapStorage.load(activeTrackName);
        if (!trackMap) {
          const imported = findTinyPedalTrackMap(
            activeTrackName,
            tinyPedalTrackMapDirectories()
          );
          if (imported) {
            trackMap = imported.map;
            try {
              mapStorage.save(activeTrackName, imported.map);
              logger.info(
                `[lmuSdkBridge] Imported track map for ${activeTrackName} from ${imported.filePath}`
              );
            } catch (error) {
              logger.error(
                '[lmuSdkBridge] Failed to save imported track map',
                error
              );
            }
          }
        }
        mapRecorder.reset(activeTrackName);
        lastSessionSignature = null;
        logger.info(
          `[lmuSdkBridge] Track ${activeTrackName}; map ${trackMap ? 'loaded' : 'not found; recording starts at the next finish-line crossing'}`
        );
      }
      if (!trackMap) {
        const recordedMap = mapRecorder.update(raw);
        if (recordedMap) {
          try {
            mapStorage.save(activeTrackName, recordedMap);
            trackMap = recordedMap;
            lastSessionSignature = null;
            logger.info(
              `[lmuSdkBridge] Recorded track map for ${activeTrackName}`
            );
          } catch (error) {
            logger.error('[lmuSdkBridge] Failed to save track map', error);
          }
        }
      }

      if (!wasRunning) {
        logger.info(
          `[lmuSdkBridge] LMU is running; version=${raw.gameVersion} session=${raw.session} phase=${raw.gamePhase} vehicles=${raw.numVehicles}/${raw.activeVehicles} player=${raw.playerVehicleIdx} trackLength=${raw.lapDist}`
        );
        wasRunning = true;
        publishRunningState(true);
        lifecycle?._onEnter({ replay: false });
      }

      const tickTime = performance.now();
      let session: Session | null = null;
      if (rawSession) {
        lastSessionPollTime = tickTime;
        const signature = lmuSessionSignature(rawSession);
        if (signature !== lastSessionSignature) {
          lastSessionSignature = signature;
          session = mapLmuSession(rawSession, trackMap);
          const playerIdx = rawSession.playerVehicleIdx;
          logger.info(
            `[lmuSdkBridge] Session snapshot track=${rawSession.trackName} session=${rawSession.session} phase=${rawSession.gamePhase} flags=${Array.from(rawSession.sectorFlags).join(',')} sector=${rawSession.vehSector[playerIdx] ?? -1} sectors=${rawSession.vehLastSector1[playerIdx] ?? -1},${rawSession.vehLastSector2[playerIdx] ?? -1},${rawSession.vehLastLapTime[playerIdx] ?? -1}`
          );
        }
      }

      const blindSpotDataIssue =
        mapLmuCarLeftRight(raw) === null
          ? 'vehicle world positions or player orientation are unavailable'
          : raw.lapDist <= 0
            ? `track length is invalid (${raw.lapDist} m)`
            : null;
      if (blindSpotDataIssue !== lastBlindSpotDataIssue) {
        lastBlindSpotDataIssue = blindSpotDataIssue;
        if (blindSpotDataIssue) {
          logger.warn(
            `[lmuSdkBridge] Blind spot monitor unavailable: ${blindSpotDataIssue}`
          );
        } else {
          logger.info('[lmuSdkBridge] Blind spot monitor data available');
        }
      }

      perfMetrics.markStart('lifecycleTelemetry');
      const telemetry = mapLmuTelemetry(raw);
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
        overlayManager.publishMessage(
          'telemetryInspector:telemetry',
          telemetry
        );
      }
      telemetryCallbacks.forEach((callback) => callback(telemetry));
      perfMetrics.tick(telemetry);

      if (session) {
        latestSession = session;
        lifecycle?._onSession(session);
        processorHost?.onSession(session);
        overlayManager.publishMessage('sessionData', session);
        sessionCallbacks.forEach((callback) => callback(session));
      }

      perfMetrics.markEnd('processTelemetry');
      const remainingDelay = Math.max(
        0,
        TELEMETRY_POLL_INTERVAL - (performance.now() - pollStartedAt)
      );
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
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
      if (lastRunningState !== undefined) callback(lastRunningState);
      return () => {
        runningStateCallbacks.delete(callback);
      };
    },
    stop: () => {
      shouldStop = true;
      overlayManager.clearLatestSessionData?.();
      sdk.stop();
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
      processorHost?.dispose();
      perfMetrics.stopReporting();
    },
    // LMU has no broadcast/replay API; camera/replay controls are no-ops.
    changeCameraNumber: () => undefined,
    changeReplayPosition: () => undefined,
    triggerReplaySessionSearch: () => undefined,
  };
}
