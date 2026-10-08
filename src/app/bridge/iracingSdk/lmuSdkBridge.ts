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
import { mapLmuSession } from '../../lmu/mapSession';
import { lmuSessionSignature } from '../../lmu/sessionSignature';
import {
  LMU_DISCONNECT_GRACE_MS,
  shouldHoldLmuRunningState,
} from '../../lmu/runningState';
import { mapLmuTelemetry } from '../../lmu/mapTelemetry';
import { lmuRelativePositionsAvailable } from '../../lmu/proximity';
import {
  createLmuLapDistanceState,
  resetLmuLapDistanceState,
} from '../../lmu/lapDistance';
import {
  createLmuOpponentLapDistanceState,
  resetLmuOpponentLapDistanceState,
} from '../../lmu/opponentLapDistance';
import { lmuRestOrigin } from '../../lmu/rest/constants';
import { createLmuRestTransport } from '../../lmu/rest/httpJson';
import { createLmuRestPoller } from '../../lmu/rest/poller';
import { createLmuRestData } from '../../lmu/rest/state';
import { createLmuTapeRestTransport } from '../../lmu/rest/tapeTransport';
import {
  loadLmuTrackMap,
  LmuTrackMapRecorder,
  LmuTrackMapStorage,
  tinyPedalTrackMapDirectories,
} from '../../lmu/trackMap';
import { app } from 'electron';
import path from 'node:path';

/**
 * Poll cadence for the LMU shared-memory frame.
 *
 * LMU publishes telemetry at 100 Hz -- measured, not assumed: 999 frames in
 * 10 s against LMU 14150, median gap 9.92 ms. Not the ~60 Hz this once
 * claimed, which is where the 16 ms came from.
 *
 * 16 ms was close to the worst value available. The Windows timer tick is
 * ~15.6 ms, so a 16 ms request cannot be met by the next tick and waits for
 * the second one: measured in the Electron main process, setTimeout(16)
 * delivered a 30.7 ms median -- 37 Hz against a 100 Hz writer, dropping ~60%
 * of frames. 8 ms rounds to a single tick, 15.5 ms, 64 Hz.
 *
 * 64 Hz is the JS ceiling here. setTimeout(4) measured identically, and
 * reaching 100 Hz needs a native capture thread.
 *
 * There is deliberately no gate on delivery. Because the poll is slower than
 * the writer, nearly every poll carries a new frame -- the measured duplicate
 * rate is 0.3% -- so a gate saves almost nothing while sitting in front of
 * every telemetry consumer in the app, where it can silence all of them at
 * once.
 */
const TELEMETRY_POLL_INTERVAL = 8;
// Session snapshots are rebuilt from shared memory on demand; 2 Hz is plenty
// for driver-grid changes and mirrors the iRacing bridge's session poll rate.
const SESSION_POLL_INTERVAL = 500;
// How often to re-check the shared-memory map's existence when LMU is closed.
const RETRY_INTERVAL = 1000;
const perfRunConfig = getPerfRunConfig();
const perfTelemetryDeliveryEnabled =
  !perfRunConfig.enabled || perfRunConfig.telemetryDelivery === 'on';

export async function publishLmuSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  logger.info(
    '[lmuSdkBridge] Loading Le Mans Ultimate shared-memory bridge...'
  );
  const { NativeLmu } = await import('../../lmu/native');
  const sdk = new NativeLmu();
  const mapRecorder = new LmuTrackMapRecorder();
  const mapStorage = new LmuTrackMapStorage(
    path.join(app.getPath('userData'), 'lmu-track-maps.json')
  );

  // Properties LMU serves over its local REST API. The poller runs on its own
  // timers; this loop only ever reads the object it fills, synchronously. See
  // lmu/rest/poller.ts for why that separation is structural rather than a
  // matter of discipline.
  const restData = createLmuRestData();
  // A tape carries its own recorded REST responses, so a replay must read them
  // rather than hit a port the sim is not serving. Everything above the
  // transport is identical either way, which is the point of injecting it:
  // a replay exercises the real poller, not a shortcut around it.
  const restTransport = process.env.IRDASHIES_LMU_REPLAY
    ? createLmuTapeRestTransport(sdk)
    : createLmuRestTransport(lmuRestOrigin());
  const restPoller = createLmuRestPoller({
    data: restData,
    transport: restTransport,
    logger: {
      info: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
    },
  });
  let lastRestRevision = restData.revision;

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
  // Lifts the player's lap fraction from LMU's 5 Hz scoring block to the poll
  // rate. Held across frames, and reset only at the two real discontinuities
  // below -- never on the grace-hold path, where re-anchoring mid-lap would
  // drop the estimate back a few centimetres and silently cost a sample.
  const lapDistanceState = createLmuLapDistanceState();
  // Per-car integrators, so opponents get a poll-rate lap position too rather
  // than the 5 Hz scoring steps everything downstream would differentiate.
  const opponentLapDistanceState = createLmuOpponentLapDistanceState();

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
    let unavailableSince: number | null = null;

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
        const unavailableAt = performance.now();
        const firstUnavailableFrame = unavailableSince === null;
        unavailableSince ??= unavailableAt;
        if (
          shouldHoldLmuRunningState(wasRunning, unavailableSince, unavailableAt)
        ) {
          if (firstUnavailableFrame) {
            logger.warn(
              `[lmuSdkBridge] Telemetry unavailable; holding running state for up to ${LMU_DISCONNECT_GRACE_MS} ms`
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, TELEMETRY_POLL_INTERVAL)
          );
          if (shouldStop) break;
          continue;
        }
        if (wasRunning) {
          logger.info(
            `[lmuSdkBridge] LMU telemetry unavailable for ${Math.round(unavailableAt - unavailableSince)} ms; confirming disconnect`
          );
          publishRunningState(false);
          latestSession = null;
          overlayManager.clearLatestSessionData?.();
          lifecycle?._onDisconnect();
          wasRunning = false;
          lastSessionSignature = null;
          resetLmuLapDistanceState(lapDistanceState);
          resetLmuOpponentLapDistanceState(opponentLapDistanceState);
          restPoller.setActive(false);
        }
        unavailableSince = null;
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
        if (shouldStop) break;
        sdk.start();
        continue;
      }

      if (unavailableSince !== null) {
        logger.info(
          `[lmuSdkBridge] Telemetry recovered after ${Math.round(performance.now() - unavailableSince)} ms; running state preserved`
        );
        unavailableSince = null;
      }

      if (raw.trackName !== activeTrackName) {
        activeTrackName = raw.trackName;
        const loadedMap = loadLmuTrackMap(
          activeTrackName,
          mapStorage,
          tinyPedalTrackMapDirectories()
        );
        trackMap = loadedMap?.map ?? null;
        if (loadedMap?.source === 'tinyPedal') {
          try {
            mapStorage.save(activeTrackName, loadedMap.map);
            logger.info(
              `[lmuSdkBridge] Imported track map for ${activeTrackName} from ${loadedMap.filePath}`
            );
          } catch (error) {
            logger.error(
              '[lmuSdkBridge] Failed to save imported track map',
              error
            );
          }
        }
        mapRecorder.reset(activeTrackName);
        // Session settings and the forecast are fetched once per activation,
        // and a new track means a new session.
        restPoller.invalidateOnce();
        resetLmuLapDistanceState(lapDistanceState);
        resetLmuOpponentLapDistanceState(opponentLapDistanceState);
        lastSessionSignature = null;
        logger.info(
          `[lmuSdkBridge] Track ${activeTrackName}; map ${trackMap ? 'loaded' : 'not found; recording starts at the next finish-line crossing'}`
        );
      }

      if (!wasRunning) {
        logger.info(
          `[lmuSdkBridge] LMU is running; version=${raw.gameVersion} session=${raw.session} phase=${raw.gamePhase} vehicles=${raw.numVehicles}/${raw.activeVehicles} player=${raw.playerVehicleIdx} trackLength=${raw.lapDist}`
        );
        wasRunning = true;
        restPoller.setActive(true);
        publishRunningState(true);
        lifecycle?._onEnter({ replay: false });
      }

      const tickTime = performance.now();

      // A REST-sourced session value changing is invisible to
      // lmuSessionSignature, which only sees shared memory. Forcing the
      // signature null is the same lever the track map uses above, and without
      // it a value like timeScale would arrive and never be published.
      if (restData.revision !== lastRestRevision) {
        lastRestRevision = restData.revision;
        lastSessionSignature = null;
      }

      let session: Session | null = null;
      if (rawSession) {
        lastSessionPollTime = tickTime;
        const signature = lmuSessionSignature(rawSession);
        if (signature !== lastSessionSignature) {
          lastSessionSignature = signature;
          session = mapLmuSession(rawSession, trackMap, restData.session);
          const playerIdx = rawSession.playerVehicleIdx;
          logger.info(
            `[lmuSdkBridge] Session snapshot track=${rawSession.trackName} session=${rawSession.session} phase=${rawSession.gamePhase} flags=${Array.from(rawSession.sectorFlags).join(',')} sector=${rawSession.vehSector[playerIdx] ?? -1} sectors=${rawSession.vehLastSector1[playerIdx] ?? -1},${rawSession.vehLastSector2[playerIdx] ?? -1},${rawSession.vehLastLapTime[playerIdx] ?? -1}`
          );
        }
      }

      const blindSpotDataIssue = !lmuRelativePositionsAvailable(raw)
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
      const telemetry = mapLmuTelemetry(
        raw,
        lapDistanceState,
        opponentLapDistanceState
      );
      lifecycle?._onTelemetry(telemetry);
      perfMetrics.markEnd('lifecycleTelemetry');

      // Runs below the frame build because it consumes it: the reconstructed
      // fraction moves at the poll rate, where raw scoring only steps at 5 Hz
      // and left the recorder sampling about one point in thirteen. Kept out
      // of the span above so a map save cannot inflate that metric.
      //
      // A map first recorded on this frame is therefore published on the next
      // poll carrying a session snapshot -- up to SESSION_POLL_INTERVAL later
      // -- rather than in this one. A map appears once per track, so the
      // delay is invisible; the existing signature reset is what forces it.
      if (!trackMap) {
        const recordedMap = mapRecorder.update(
          raw,
          telemetry.LapDistPct?.value[0] as number | undefined
        );
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
  })().catch((error) => {
    logger.error('[lmuSdkBridge] Telemetry loop failed', error);
    // This loop is the only thing in this bridge that ever reports LMU going
    // away -- unlike the iRacing bridge, there is no running-state poll
    // outside it. Staying quiet here would leave the overlays, and the
    // auto-detector deciding whether to look for another simulator, believing
    // a dead source is still feeding them.
    if (lastRunningState) {
      latestSession = null;
      overlayManager.clearLatestSessionData?.();
      lifecycle?._onDisconnect();
    }
    restPoller.setActive(false);
    publishRunningState(false);
  });

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
      restPoller.stop();
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
