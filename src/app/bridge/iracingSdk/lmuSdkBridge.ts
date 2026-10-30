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
import { isLmuAiEntry, lmuPlayerSlot } from '../../lmu/aiControl';
import {
  lmuRosterSignature,
  lmuSessionSignature,
} from '../../lmu/sessionSignature';
import { createRosterGate } from '../../lmu/rosterSettle';
import { createLmuSessionIdentity } from '../../lmu/sessionIdentity';
import { createLmuDataFreeze } from '../../lmu/dataFreeze';
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
import { createLmuLiveStandings } from '../../lmu/liveStandings/client';
import { lmuLivePenaltyChannels } from '../../lmu/liveStandings/penalties';
import { createLmuWebSocket } from '../../lmu/liveStandings/socket';
import type { LmuLivePenaltyChannels } from '../../lmu/liveStandings/penalties';
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
/**
 * How slow a session rebuild has to be before it is worth a line in the log.
 *
 * perfMetrics is the proper instrument, but it is opt-in -- every mark returns
 * early unless PERF_METRICS=1 -- so on an ordinary run its spans measure
 * nothing. Rebuilding the snapshot and broadcasting it is the one thing in
 * this loop that happens in bursts and can stall the sim, and finding that out
 * should not require relaunching the app with an environment variable set.
 *
 * 20 ms is two and a half telemetry polls: long enough that the frame budget
 * has been missed and short enough to catch it before it is visible.
 */
const SLOW_SESSION_MS = 20;

/**
 * The quietest this warning can be while still being useful.
 *
 * A grid filling in produces a run of slow rebuilds, and twenty lines saying
 * so is no more informative than one. Rate limited rather than deduped on the
 * message, because the number is the point and it differs every time.
 */
const SLOW_SESSION_LOG_INTERVAL_MS = 10_000;

/**
 * When a whole loop iteration is worth reporting.
 *
 * The loop aims for an 8 ms period, so an iteration that takes longer than
 * this has eaten the next one and is holding the main process. Everything
 * else in this file is measured behind PERF_METRICS, which is off in the
 * builds anybody actually runs -- so the native reads, the per-car array
 * building and the telemetry publish have never been measured in the field at
 * all. The session build and broadcast were, and have never once exceeded
 * their own threshold, which is exactly why the rest needs covering before
 * anyone concludes anything about where a stutter comes from.
 */
const SLOW_ITERATION_MS = 12;

/**
 * How often to look while the data is frozen.
 *
 * Slow enough to cost nothing, quick enough that coming back from the menus
 * feels immediate. TinyPedal uses 500 ms for the same state.
 */
const FROZEN_POLL_INTERVAL = 250;

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
const gridUsernames = (raw: {
  readonly drivers: readonly {
    id: number;
    name: string;
    control?: number;
    isPlayer?: boolean;
  }[];
  readonly playerHasVehicle?: boolean;
  readonly playerVehicleIdx?: number;
}): string[] => {
  const ownSlot = lmuPlayerSlot(raw);
  return (
    raw.drivers
      // AI entries are left out, and not as an optimisation. RaceOS is asked by
      // name, the sim names its AI after real people, and the service has no way
      // to know the difference -- so an AI called "Herve Attard" is handed that
      // person's rank and badge. The lookup is the first of two places this is
      // blocked; mapSession declines to merge one too, because a cached answer
      // for a human of the same name needs no lookup to reach an AI's row.
      //
      // The player is never an AI, whatever control says: LMU holds your car
      // under AI control until you take it, so this skipped your own name for as
      // long as you sat in the garage, and your row showed the AI badge while
      // every other driver was ranked. See aiControl.ts.
      //
      // `control === 1` only otherwise. isLmuAiEntry returns undefined when the
      // sim did not report control at all, and `!undefined` keeps the entry: a
      // missing field must not quietly cost a human their rank.
      .filter(
        (driver) =>
          !isLmuAiEntry({
            control: driver.control,
            isPlayer: driver.isPlayer || driver.id === ownSlot,
          })
      )
      .map((driver) => raceosUsername(driver.name ?? ''))
      .filter((name) => name.length > 0)
  );
};

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

  // Which penalty each car is serving, from LMU's UI websocket -- the only
  // source that names a kind, and the only one that names it for a car other
  // than the player. Not created for a tape replay: a tape records shared
  // memory and REST, so there is no recorded socket to replay and the badges
  // fall back to the player-only estimate exactly as they did before.
  const liveStandings = isTapeReplay
    ? undefined
    : createLmuLiveStandings({
        connect: createLmuWebSocket,
        logger: {
          info: (message) => logger.info(message),
          warn: (message) => logger.warn(message),
        },
      });
  /**
   * Per-car penalty cells, rebuilt only when the feed or the grid changes.
   *
   * Cells rather than arrays so the frame build assigns a reference: the loop
   * runs every 8 ms and these change a handful of times a session.
   */
  let penaltyChannels: LmuLivePenaltyChannels | undefined;
  let penaltyRoster: readonly { id: number; name: string }[] = [];
  let lastPenaltyRosterSignature: string | null = null;
  let lastPenaltyRevision = -1;

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
  /** When a slow rebuild was last reported, for the rate limit. */
  let lastSlowSessionLog = Number.NEGATIVE_INFINITY;
  /** Set by the rebuild, read by the publish below, so both are timed once. */
  let mapSessionMs = 0;
  /**
   * Holds a rebuild back while the grid is filling.
   *
   * LMU admits drivers one per session poll, so a grid loading in was twenty
   * full rebuilds and twenty whole-snapshot broadcasts in ten seconds, which
   * is where the sim hitched. See rosterSettle.ts.
   */
  const rosterGate = createRosterGate();
  /**
   * Which session this is. Observed once per iteration below and read by both
   * mappers, so the frame and the snapshot cannot disagree about it.
   *
   * Stateful because LMU gives no unique id and the only way to tell a server
   * rolling its practice session from the same session continuing is that the
   * clock and the lap count go backwards. See sessionIdentity.ts.
   */
  const sessionIdentity = createLmuSessionIdentity();
  /**
   * Whether the sim has stopped writing shared memory.
   *
   * Ending a session leaves the block readable and stale, so without this the
   * last snapshot was taken at face value forever. See dataFreeze.ts.
   */
  const dataFreeze = createLmuDataFreeze();
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
  // client the grid's driver names and reads back only what it has already
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
  // `anonymise` bakes the ratings into the tape instead, keyed by the same
  // pseudonymised names its snapshots carry, so a replay shows the badges it
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
    let lastSlowIterationLog = Number.NEGATIVE_INFINITY;
    let worstIteration = 0;
    let worstRead = 0;
    let iterations = 0;

    while (!shouldStop) {
      const pollStartedAt = performance.now();
      const shouldPollSession =
        pollStartedAt - lastSessionPollTime >= SESSION_POLL_INTERVAL;
      perfMetrics.markStart('processTelemetry');
      perfMetrics.markStart(
        shouldPollSession ? 'sdkSessionRead' : 'sdkTelemetryRead'
      );
      const readStartedAt = performance.now();
      const rawSession = shouldPollSession ? sdk.readSession() : null;
      const raw = rawSession ?? sdk.read();
      const readMs = performance.now() - readStartedAt;
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
          sessionIdentity.reset();
          dataFreeze.reset();
          restPoller.setActive(false);
          liveStandings?.setActive(false);
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
        liveStandings?.setActive(true);
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
      // Before either mapper, and before the session poll below rather than
      // next to the frame build: the session snapshot is mapped first, so
      // observing after it published SubSessionID 0 on the first snapshot of
      // every run and a spurious session change on the next one.
      //
      // Before either mapper, so both describe the same session. A change
      // here is what makes every consumer that compares session ids -- race
      // control, lap history, the reference lap, the replay context -- reset.
      sessionIdentity.observe({
        trackName: raw.trackName,
        session: raw.session,
        serverName: raw.serverName,
        endET: raw.endET,
        currentET: raw.currentET,
        playerLaps:
          raw.playerHasVehicle && raw.playerVehicleIdx >= 0
            ? raw.vehTotalLaps?.[raw.playerVehicleIdx]
            : undefined,
        playerSlot:
          raw.playerHasVehicle && raw.playerVehicleIdx >= 0
            ? raw.playerVehicleIdx
            : undefined,
        sessionStartEvents: raw.sessionStartEvents,
        sessionEndEvents: raw.sessionEndEvents,
      });
      const frozen = dataFreeze.observe(
        { scoringUpdates: raw.scoringUpdates, currentET: raw.currentET },
        tickTime
      );
      if (dataFreeze.justChanged()) {
        logger.info(
          frozen
            ? '[lmuSdkBridge] Shared memory stopped updating; treating the ' +
                'player as out of the car'
            : '[lmuSdkBridge] Shared memory updating again'
        );
      }

      const sessionChange = sessionIdentity.lastChange();
      // The frame takes the new id at once; the snapshot has to as well, or
      // its SubSessionID keeps naming the session before. Its signature sees
      // neither the epoch nor the server or length in the stamp, so an
      // online practice that ends with the clock and grid standing still
      // would never be rebuilt.
      if (sessionChange) lastSessionSignature = null;
      if (sessionChange && sessionChange !== 'stamp') {
        // 'event' is the sim's own StartSession/EndSession callback. The other
        // two are inferences from the clock or the lap count, and worth
        // telling apart in the log when one of them fires instead.
        // A stamp change is already obvious from the track or session-type
        // lines around it. These two are not: nothing else in the log would
        // say why every consumer just reset.
        logger.info(
          sessionChange === 'event'
            ? `[lmuSdkBridge] Session boundary reported by the sim; ` +
                `id=${sessionIdentity.current()}`
            : `[lmuSdkBridge] New session detected from the ${sessionChange} ` +
                `going backwards; id=${sessionIdentity.current()}`
        );
      }

      if (rawSession) {
        lastSessionPollTime = tickTime;
        // Queued on every session poll, not only when the snapshot is rebuilt
        // below. A driver joining mid-session is a reason to ask even if
        // nothing else about the grid moved, and an id already resolved,
        // remembered as a miss or in flight costs one set lookup to skip.
        ratingClient.request(gridUsernames(rawSession));
        const signature = lmuSessionSignature(rawSession);
        // Only the roster is gated. Anything else that moves -- a position, a
        // lap time, the weather -- rebuilds at once as it always did, because
        // those arrive steadily rather than in bursts.
        const rosterSignature = lmuRosterSignature(rawSession);
        // The grid the penalty feed is keyed to. Driver name is the only field
        // the websocket and shared memory share, so the join needs the names,
        // and only the session snapshot carries them -- which is why this sits
        // here rather than beside the frame build below.
        if (rosterSignature !== lastPenaltyRosterSignature) {
          lastPenaltyRosterSignature = rosterSignature;
          penaltyRoster = rawSession.drivers.map((driver) => ({
            id: driver.id,
            name: driver.name,
          }));
          // Forces the rebuild below even if the feed has sent nothing since:
          // a driver who joined needs their code looked up once.
          lastPenaltyRevision = -1;
        }
        const waitingForRoster = rosterGate.shouldWait(
          rosterSignature,
          tickTime
        );
        if (signature !== lastSessionSignature && !waitingForRoster) {
          lastSessionSignature = signature;
          // Its own span: a rebuild is the expensive half of a driver
          // joining, and processTelemetry brackets the whole iteration, so
          // without this the cost is mixed in with everything else the loop
          // does and cannot be shown to have changed.
          perfMetrics.markStart('mapSession');
          const mapStartedAt = performance.now();
          session = mapLmuSession(
            rawSession,
            trackMap,
            restData.session,
            (driverName) => ratingClient.get(driverName),
            sessionIdentity
          );
          mapSessionMs = performance.now() - mapStartedAt;
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

      // Cheap on every iteration and real work only when something changed:
      // `state()` ages the feed and reports a revision, and a grid of 60 name
      // lookups runs on the handful of iterations where that revision moved.
      const livePenalties = liveStandings?.state();
      if (livePenalties && livePenalties.revision !== lastPenaltyRevision) {
        lastPenaltyRevision = livePenalties.revision;
        penaltyChannels = lmuLivePenaltyChannels(
          penaltyRoster,
          livePenalties.entries
        );
      }

      perfMetrics.markStart('lifecycleTelemetry');
      const telemetry = mapLmuTelemetry(
        raw,
        lapDistanceState,
        opponentLapDistanceState,
        // The REST cells, which were never passed: the parameter has existed
        // since the poller was written and the only call site supplied three
        // arguments, so LmuPitStopTime, LmuRepairTime, LmuRefuelTarget and the
        // damage channels have been undefined in every build. Wiring it here
        // activates those too -- which is what they were built for.
        restData.cells,
        sessionIdentity,
        frozen,
        penaltyChannels
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
        const publishStartedAt = performance.now();
        lifecycle?._onSession(session);
        processorHost?.onSession(session);
        overlayManager.publishMessage('sessionData', session);
        const publishMs = performance.now() - publishStartedAt;
        perfMetrics.markEnd('publishSession');

        // Reported without PERF_METRICS, because by the time someone wants
        // this number the sim has already stuttered and they are reading the
        // log they have rather than relaunching to collect a better one.
        const total = mapSessionMs + publishMs;
        if (
          total >= SLOW_SESSION_MS &&
          tickTime - lastSlowSessionLog >= SLOW_SESSION_LOG_INTERVAL_MS
        ) {
          lastSlowSessionLog = tickTime;
          logger.warn(
            `[lmuSdkBridge] Slow session update: ${total.toFixed(1)}ms ` +
              `(build ${mapSessionMs.toFixed(1)}ms, publish ${publishMs.toFixed(1)}ms) ` +
              `for ${session.DriverInfo?.Drivers?.length ?? 0} drivers`
          );
        }
        sessionCallbacks.forEach((callback) => callback(session));
      }

      perfMetrics.markEnd('processTelemetry');

      // The whole iteration, including the shared-memory copy, the per-car
      // array building and the publish to every window -- the parts no
      // always-on measurement covered. Worst of the window rather than the
      // latest, since one overrun in a hundred is what a stutter is.
      const iterationMs = performance.now() - pollStartedAt;
      iterations += 1;
      if (iterationMs > worstIteration) worstIteration = iterationMs;
      if (readMs > worstRead) worstRead = readMs;
      if (
        worstIteration >= SLOW_ITERATION_MS &&
        pollStartedAt - lastSlowIterationLog >= SLOW_SESSION_LOG_INTERVAL_MS
      ) {
        lastSlowIterationLog = pollStartedAt;
        logger.warn(
          `[lmuSdkBridge] Slow loop: worst ${worstIteration.toFixed(1)}ms ` +
            `(read ${worstRead.toFixed(1)}ms) over ${iterations} iterations ` +
            `for ${raw.numVehicles ?? 0} vehicles`
        );
        worstIteration = 0;
        worstRead = 0;
        iterations = 0;
      }

      // Frozen data cannot change, so there is nothing to read at the poll
      // rate: a 325 KB copy and every processor, 125 times a second, over a
      // snapshot the sim has stopped writing. Backing off is what TinyPedal
      // does too, and it is the only part of this that the sim notices.
      const pollInterval = frozen
        ? FROZEN_POLL_INTERVAL
        : TELEMETRY_POLL_INTERVAL;
      const remainingDelay = Math.max(
        0,
        pollInterval - (performance.now() - pollStartedAt)
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
    liveStandings?.stop();
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
