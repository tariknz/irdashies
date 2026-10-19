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
import { sessionSecondsFrameClock } from '../../processors/ProcessorHost';
import { mapLmuSession } from '../../lmu/mapSession';
import {
  lmuRosterSignature,
  lmuSessionSignature,
} from '../../lmu/sessionSignature';
import { createRosterGate } from '../../lmu/rosterSettle';
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
import { createRaceosClient, type RaceosClient } from '../../lmu/raceos/client';
import { raceosUsername } from '../../lmu/raceos/parse';
import { createLmuTapeRatingClient } from '../../lmu/raceos/tapeRatings';
import { createRaceosTransport } from '../../lmu/raceos/httpsJson';
import { createTicketFetcher } from '../../lmu/raceos/ticket';
import {
  createDriverRatingCache,
  type DriverRatingCache,
} from '../../storage/driverRatings';
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

/**
 * The driver names on the grid to ask the rating service about.
 *
 * Names, not Steam ids. The sim reports 0 for every driver's Steam id -- in
 * shared memory and over its own REST API alike -- so there was never an id to
 * key on, and the service takes a list of usernames in any case.
 *
 * Canonicalised by raceosUsername, which is also applied to the names coming
 * back, so both sides of the join agree.
 */
const gridUsernames = (drivers: readonly { name: string }[]): string[] =>
  drivers
    .map((driver) => raceosUsername(driver.name ?? ''))
    .filter((name) => name.length > 0);

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
  const isTapeReplay = Boolean(process.env.IRDASHIES_LMU_REPLAY);
  const restTransport = isTapeReplay
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
          // The LMU mapping puts session seconds into SessionTick.
          frameClock: sessionSecondsFrameClock,
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
  /** Last reported rating tally, so a settled grid is reported once. */
  let lastRatingTally: string | null = null;
  /**
   * Holds a rebuild back while the grid is filling.
   *
   * LMU admits drivers one per session poll, so a grid loading in was twenty
   * full rebuilds and twenty whole-snapshot broadcasts in ten seconds, which
   * is where the sim hitched. See rosterSettle.ts.
   */
  const rosterGate = createRosterGate();
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

  // Driver ranks and badges, from the rating service LMU's own ecosystem uses.
  //
  // Deliberately the loosest coupling in this bridge. The loop hands the
  // client a list of Steam ids and reads back only what it has already
  // resolved, synchronously -- every request, token exchange, retry and cache
  // write happens on the client's own timers. So the service being slow, down
  // or unreachable costs the telemetry loop nothing and leaves the standings
  // rendering exactly as they do without ratings at all.
  //
  // The credential chain is documented in raceos/client.ts; the short version
  // is that it needs a Steam auth ticket the sim mints, so ratings exist only
  // while LMU is running and signed in. The join is on driver name, because
  // the sim reports 0 for every Steam id it publishes.
  //
  // A replay takes the other branch entirely, because the recorder never
  // captures that ticket -- it is a live credential and a tape is a fixture.
  // `anonymise` bakes the ratings into the tape instead, under synthetic Steam
  // ids matching the ones in its snapshots, so a replay shows the badges it
  // was recorded with and carries no real identity.
  let ratingCache: DriverRatingCache | undefined;
  let ratingClient: RaceosClient;
  if (isTapeReplay) {
    logger.info(
      '[lmuSdkBridge] Driver ratings: reading what the tape was anonymised with'
    );
    ratingClient = createLmuTapeRatingClient(sdk);
  } else {
    logger.info(
      '[lmuSdkBridge] Driver ratings: looking up live via the rating service'
    );
    ratingCache = createDriverRatingCache(app.getPath('userData'));
    // Awaited before the loop starts so the first grid is matched against what
    // the last session already learned, rather than re-asking for all of it.
    await ratingCache.load();
    ratingClient = createRaceosClient({
      transport: createRaceosTransport(),
      cache: ratingCache,
      fetchTicket: createTicketFetcher(restTransport),
      // Ratings land long after the snapshot that asked for them was
      // published, so something has to force a republish. Dropping the
      // signature is the same lever the track map and the REST revision pull
      // above; without it a resolved rank would sit in the cache unseen until
      // an unrelated field happened to move the signature on its own.
      onResolved: () => {
        lastSessionSignature = null;
      },
    });
  }

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

  // Held so stop() can let go of it. setupBridge rebuilds this bridge on every
  // source change, and auto-detect rebuilds it on every sim takeover, so a
  // listener left registered belongs to a bridge that has stopped -- and it
  // kept answering, handing the dead bridge's running state and session to
  // every overlay opened afterwards. A stale `true` would overwrite the real
  // state. The iRacing bridge already does this.
  const unsubscribeOverlayReady = overlayManager.onOverlayReady((id) => {
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
          rosterGate.reset();
          restPoller.setActive(false);
          // The token was bought with a ticket this sim run minted, and a
          // queue that outlives the session has nothing left to ask with.
          // What was already resolved stays: that lives in the cache.
          ratingClient.reset();
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
        // Queued on every session poll, not only when the snapshot is rebuilt
        // below. A driver joining mid-session is a reason to ask even if
        // nothing else about the grid moved, and an id already resolved,
        // remembered as a miss or in flight costs one set lookup to skip.
        ratingClient.request(gridUsernames(rawSession.drivers));
        const signature = lmuSessionSignature(rawSession);
        // Only the roster is gated. Anything else that moves -- a position, a
        // lap time, the weather -- rebuilds at once as it always did, because
        // those arrive steadily rather than in bursts.
        const waitingForRoster = rosterGate.shouldWait(
          lmuRosterSignature(rawSession),
          tickTime
        );
        if (signature !== lastSessionSignature && !waitingForRoster) {
          lastSessionSignature = signature;
          // Its own span: a rebuild is the expensive half of a driver
          // joining, and processTelemetry brackets the whole iteration, so
          // without this the cost is mixed in with everything else the loop
          // does and cannot be shown to have changed.
          perfMetrics.markStart('mapSession');
          session = mapLmuSession(
            rawSession,
            trackMap,
            restData.session,
            (driverName) => ratingClient.get(driverName)
          );
          perfMetrics.markEnd('mapSession');

          // What actually went out, counted on the published snapshot rather
          // than inferred from the lookup.
          //
          // "Matched n/n" says the service answered and the answers were filed
          // under names the grid presents. It does not say they reached a
          // driver: the country arrives by a different route, so a snapshot
          // with flags and no ranks looks identical from the renderer's side
          // and from the log's. This is the only line that tells the two
          // apart, and it reads the object that is about to be published.
          const drivers = session.DriverInfo?.Drivers ?? [];
          const ranked = drivers.filter(
            (d) => d.LmuRating?.driverRank || d.LmuRating?.safetyRank
          ).length;
          const flagged = drivers.filter(
            (d) => d.LmuRating?.countryCode
          ).length;
          const badged = drivers.filter((d) => d.LmuRating?.badge).length;
          const tally = `${ranked} ranked, ${badged} badged, ${flagged} flagged of ${drivers.length}`;
          if (tally !== lastRatingTally) {
            lastRatingTally = tally;
            logger.info(`[lmuSdkBridge] Published ratings: ${tally}`);
          }
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
        // The other half: a whole-snapshot structured clone to every visible
        // overlay window, plus whatever the lifecycle and the processors do
        // with it. Measured apart from the build because the two are fixed by
        // different things.
        perfMetrics.markStart('publishSession');
        lifecycle?._onSession(session);
        processorHost?.onSession(session);
        overlayManager.publishMessage('sessionData', session);
        perfMetrics.markEnd('publishSession');
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
    ratingClient.reset();
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
      unsubscribeOverlayReady?.();
      restPoller.stop();
      ratingClient.reset();
      // Cache writes are debounced behind an unref'd timer, so a rating
      // resolved in the last second before a quit is only on disk if it is
      // asked for. Losing it would just mean asking again, hence no await.
      void ratingCache
        ?.flush()
        .catch((error: unknown) =>
          logger.warn('[lmuSdkBridge] Failed to flush driver ratings', error)
        );
      // Dropped too, so nothing can replay this bridge's last session after it
      // has gone.
      latestSession = null;
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
