import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayManager } from '../../overlayManager';
import type { SessionLifecycle } from '../../sessionLifecycle';

/**
 * The LMU bridge's telemetry loop is the only thing that ever reports the sim
 * going away -- unlike the iRacing bridge, it has no running-state poll outside
 * the loop. These specs cover what the loop failing outright does, because that
 * is the path that decides whether a crashed LMU leaves the overlays (and the
 * auto-detector looking for another simulator) believing it is still alive.
 */

const sdkState = vi.hoisted(() => ({
  running: true,
  /** Makes every shared-memory read throw, as a vanished mapping would. */
  readThrows: false,
  /** The grid a session poll reports, so a spec can choose its names. */
  drivers: [] as { name: string }[],
}));

/**
 * Stands in for the whole rating feature: the client, its transport, its
 * ticket fetcher and its on-disk cache.
 *
 * All of those have their own specs. What is unverifiable anywhere but here is
 * the bridge's half of the contract -- which ids it hands over, that it reads
 * answers synchronously while building a snapshot, and that a rating arriving
 * after the fact still reaches the renderer.
 */
const ratingState = vi.hoisted(() => ({
  /** Captured so a spec can resolve a rating at a moment of its choosing. */
  onResolved: undefined as (() => void) | undefined,
  /** Every batch of ids the bridge asked about, in order. */
  requested: [] as string[][],
  get: vi.fn<(steamId: string) => undefined>(() => undefined),
  reset: vi.fn(),
  cache: {
    load: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
  },
  /** Set when the bridge chose the tape-backed client over the live one. */
  tapeClientBuilt: false,
}));

/** Shared so a spec can read the arguments the session mapper was given. */
const mapSessionSpy = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => { drivers: [] }>(() => ({ drivers: [] }))
);

/**
 * The REST state the bridge would create for itself, held here so a spec can
 * bump its revision without any HTTP.
 */
const restState = vi.hoisted(() => ({
  data: { revision: 0, cells: {}, session: {} as Record<string, unknown> },
  poller: { setActive: vi.fn(), invalidateOnce: vi.fn(), stop: vi.fn() },
}));

/** Shared so the specs can observe how the bridge drives them. */
const recorderUpdate = vi.hoisted(() => vi.fn(() => null));
const lapDistanceSpies = vi.hoisted(() => ({
  create: vi.fn(() => ({ marker: 'lap-distance-state' })),
  reset: vi.fn(),
}));

const rawFrame = () => {
  if (sdkState.readThrows) throw new Error('shared memory read failed');
  return {
    running: sdkState.running,
    gameVersion: 1,
    trackName: 'Test Track',
    session: 1,
    gamePhase: 5,
    numVehicles: 2,
    activeVehicles: 2,
    playerVehicleIdx: 0,
    lapDist: 5000,
    speed: 0,
    speedLimiter: 0,
    unfilteredThrottle: 0,
    unfilteredBrake: 1,
    vehInPits: [0, 0],
    sectorFlags: new Uint8Array([0, 0, 0]),
    vehSector: [1, 1],
    vehLastSector1: [0, 0],
    vehLastSector2: [0, 0],
    vehLastLapTime: [0, 0],
  };
};

vi.mock('../../lmu/native', () => ({
  NativeLmu: class {
    start = vi.fn(() => true);
    stop = vi.fn(() => true);
    isRunning = vi.fn(() => sdkState.running);
    read = vi.fn(rawFrame);
    readSession = vi.fn(() => ({
      ...rawFrame(),
      classes: [],
      drivers: sdkState.drivers,
    }));
  },
}));

// Only ever referenced as a type by the bridge, but stubbed so the spec does
// not drag the real window manager in.
vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/irdashies-spec' },
}));

vi.mock('../../perfRunConfig', () => ({
  getPerfRunConfig: () => ({ enabled: false }),
}));

vi.mock('../../perfMetrics', () => ({
  TelemetryPerfMetrics: class {
    startReporting = vi.fn();
    stopReporting = vi.fn();
    markStart = vi.fn();
    markEnd = vi.fn();
    tick = vi.fn();
  },
}));

vi.mock('../../processors/processorRegistry', () => ({
  createDefaultProcessorHost: vi.fn(),
}));

// Keeps the track-map work off the filesystem.
vi.mock('../../lmu/trackMap', () => ({
  loadLmuTrackMap: () => null,
  tinyPedalTrackMapDirectories: () => [],
  LmuTrackMapRecorder: class {
    reset = vi.fn();
    update = recorderUpdate;
  },
  LmuTrackMapStorage: class {
    save = vi.fn();
  },
}));

// Mapping is covered by its own specs; here it only has to not be the thing
// that throws.
vi.mock('../../lmu/mapTelemetry', () => ({
  mapLmuTelemetry: () => ({}),
  mapLmuCarLeftRight: () => 0,
}));

// The estimator has its own specs; here only the bridge's use of it matters --
// that it is threaded into the mapper and reset at the right moments.
vi.mock('../../lmu/lapDistance', () => ({
  createLmuLapDistanceState: lapDistanceSpies.create,
  resetLmuLapDistanceState: lapDistanceSpies.reset,
}));

vi.mock('../../lmu/mapSession', () => ({
  mapLmuSession: mapSessionSpy,
}));

// The rating client and its IO have their own specs; here only the bridge's
// use of them matters.
vi.mock('../../lmu/raceos/client', () => ({
  createRaceosClient: (options: { onResolved?: () => void }) => {
    ratingState.onResolved = options.onResolved;
    return {
      get: ratingState.get,
      request: (steamIds: readonly string[]) => {
        ratingState.requested.push([...steamIds]);
      },
      reset: ratingState.reset,
    };
  },
}));

vi.mock('../../lmu/raceos/httpsJson', () => ({
  createRaceosTransport: () => vi.fn(),
}));

vi.mock('../../lmu/raceos/ticket', () => ({
  createTicketFetcher: () => vi.fn(),
}));

// Keeps the rating cache off the filesystem.
vi.mock('../../storage/driverRatings', () => ({
  createDriverRatingCache: () => ratingState.cache,
}));

vi.mock('../../lmu/raceos/tapeRatings', () => ({
  createLmuTapeRatingClient: () => {
    ratingState.tapeClientBuilt = true;
    return {
      get: ratingState.get,
      request: () => undefined,
      reset: ratingState.reset,
    };
  },
}));

vi.mock('../../lmu/sessionSignature', () => ({
  lmuSessionSignature: () => 'signature',
}));

// The poller has its own specs; here only the bridge's use of it matters --
// that it is started and stopped at the right moments, and that a revision
// bump forces a session republish.
vi.mock('../../lmu/rest/state', () => ({
  createLmuRestData: () => restState.data,
  resetLmuRestData: vi.fn(),
}));

vi.mock('../../lmu/rest/poller', () => ({
  createLmuRestPoller: () => restState.poller,
}));

vi.mock('../../lmu/rest/httpJson', () => ({
  createLmuRestTransport: () => vi.fn(),
}));

const createOverlayManager = () =>
  ({
    onOverlayReady: vi.fn(),
    publishMessage: vi.fn(),
    publishMessageToOverlay: vi.fn(),
    clearLatestSessionData: vi.fn(),
    hasTelemetryInspectorSubscribers: vi.fn(() => false),
  }) as unknown as OverlayManager;

const createLifecycle = () =>
  ({
    _onEnter: vi.fn(),
    _onDisconnect: vi.fn(),
    _onTelemetry: vi.fn(),
    _onSession: vi.fn(),
  }) as unknown as SessionLifecycle;

const runningStatesPublished = (overlayManager: OverlayManager) =>
  vi
    .mocked(overlayManager.publishMessage)
    .mock.calls.filter(([channel]) => channel === 'runningState')
    .map(([, value]) => value);

describe('publishLmuSDKEvents when the telemetry loop fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkState.running = true;
    sdkState.readThrows = false;
  });

  it('reports the sim as no longer running', async () => {
    // Otherwise a crash mid-session leaves the overlays on a running state
    // that nothing will ever correct, and auto-detect never looks elsewhere.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    const observed: boolean[] = [];
    bridge.onRunningState((value) => observed.push(value));
    await vi.waitFor(() => expect(observed).toContain(true));

    sdkState.readThrows = true;

    await vi.waitFor(() => expect(observed).toContain(false));
    expect(runningStatesPublished(overlayManager)).toContain(false);
    bridge.stop();
  });

  it('releases the session it was holding', async () => {
    const overlayManager = createOverlayManager();
    const lifecycle = createLifecycle();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager, lifecycle);

    await vi.waitFor(() => expect(lifecycle._onEnter).toHaveBeenCalled());
    sdkState.readThrows = true;

    await vi.waitFor(() => expect(lifecycle._onDisconnect).toHaveBeenCalled());
    // New overlay windows opened after the crash must not be seeded with the
    // dead session's data.
    expect(overlayManager.clearLatestSessionData).toHaveBeenCalled();
    bridge.stop();
  });

  it('stays quiet when it fails before the sim was ever seen running', async () => {
    // The guard is on lastRunningState rather than the loop's own wasRunning,
    // so a bridge that never connected must not announce a disconnect it never
    // had.
    sdkState.running = false;
    sdkState.readThrows = true;
    const overlayManager = createOverlayManager();
    const lifecycle = createLifecycle();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager, lifecycle);

    const { default: logger } = await import('../../logger');
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        '[lmuSdkBridge] Telemetry loop failed',
        expect.anything()
      )
    );

    expect(lifecycle._onDisconnect).not.toHaveBeenCalled();
    expect(overlayManager.clearLatestSessionData).not.toHaveBeenCalled();
    // Only the seeded false from construction: publishRunningState must not
    // announce a change that did not happen.
    expect(runningStatesPublished(overlayManager)).toEqual([false]);
    bridge.stop();
  });
});

describe('publishLmuSDKEvents lap-distance wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkState.running = true;
    sdkState.readThrows = false;
    recorderUpdate.mockReturnValue(null);
  });

  it('feeds the track-map recorder the reconstructed fraction', async () => {
    // The recorder samples on lap distance, and raw scoring only steps at
    // 5 Hz, so without the smoothed value it collects about one point in
    // thirteen and never reaches the minimum a map needs. It therefore has to
    // run below the frame build, consuming it.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(recorderUpdate).toHaveBeenCalled());
    expect(recorderUpdate.mock.calls[0]).toHaveLength(2);

    bridge.stop();
  });

  it('threads the estimator state into the mapper', async () => {
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    // One integrator for the life of the bridge, not one per frame -- it is
    // what carries the anchor between polls.
    await vi.waitFor(() => expect(recorderUpdate).toHaveBeenCalled());
    expect(lapDistanceSpies.create).toHaveBeenCalledTimes(1);

    bridge.stop();
  });

  it('does not re-anchor the estimator while holding through a dropout', async () => {
    // The grace path exists to survive a transient dropout. Resetting there
    // would drop the estimate back to the frozen scoring value on every blip;
    // under MAX_BACKWARD_M that reads as a dropped sample rather than a
    // reversal, so it would cost resolution silently.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    const observed: boolean[] = [];
    bridge.onRunningState((value) => observed.push(value));
    await vi.waitFor(() => expect(observed).toContain(true));
    // One reset has already happened: the first frame is a track change, from
    // the empty starting name, which is a genuine discontinuity.
    const resetsAfterStartup = lapDistanceSpies.reset.mock.calls.length;

    // Frames stop arriving, but well inside LMU_DISCONNECT_GRACE_MS.
    sdkState.running = false;
    await vi.waitFor(() =>
      expect(
        vi
          .mocked(overlayManager.publishMessage)
          .mock.calls.some(([channel]) => channel === 'runningState')
      ).toBe(true)
    );

    // Still held: no disconnect was confirmed, so no re-anchor.
    expect(observed).not.toContain(false);
    expect(lapDistanceSpies.reset.mock.calls.length).toBe(resetsAfterStartup);

    bridge.stop();
  });
});

/**
 * The gate that makes REST-sourced session values visible at all.
 *
 * lmuSessionSignature only sees shared memory, so a value arriving from the
 * REST API changes nothing it hashes. The signature is pinned to a constant in
 * this file's mocks, which means a second sessionData publish here can only
 * come from the revision gate -- exactly the silent failure this guards.
 */
describe('publishLmuSDKEvents and REST-sourced session values', () => {
  const sessionPublishCount = (overlayManager: OverlayManager) =>
    vi
      .mocked(overlayManager.publishMessage)
      .mock.calls.filter(([channel]) => channel === 'sessionData').length;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkState.running = true;
    sdkState.readThrows = false;
    restState.data.revision = 0;
    restState.data.session = {};
  });

  it('republishes the session when only the REST revision moved', async () => {
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(sessionPublishCount(overlayManager)).toBe(1));
    const afterFirst = sessionPublishCount(overlayManager);

    restState.data.session = { timeScale: 6 };
    restState.data.revision += 1;

    await vi.waitFor(() =>
      expect(sessionPublishCount(overlayManager)).toBeGreaterThan(afterFirst)
    );
    bridge.stop();
  });

  it('does not republish while the revision is unchanged', async () => {
    // The other half of the gate: it must not force a rebuild every poll, or
    // a whole-object broadcast rides along with it at the poll rate.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(sessionPublishCount(overlayManager)).toBe(1));

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(sessionPublishCount(overlayManager)).toBe(1);
    bridge.stop();
  });

  it('starts the poller when LMU comes up and stops it on teardown', async () => {
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() =>
      expect(restState.poller.setActive).toHaveBeenCalledWith(true)
    );

    bridge.stop();

    expect(restState.poller.stop).toHaveBeenCalled();
  });

  it('stops polling when the sim is confirmed gone', async () => {
    // Otherwise it keeps hitting a port nothing is serving any more.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() =>
      expect(restState.poller.setActive).toHaveBeenCalledWith(true)
    );

    sdkState.readThrows = true;

    await vi.waitFor(() =>
      expect(restState.poller.setActive).toHaveBeenCalledWith(false)
    );
    bridge.stop();
  });
});

/**
 * The bridge's half of the driver-rating feature.
 *
 * Everything below the bridge -- the token exchange, the batching, the backoff
 * and the cache -- is covered by raceos/ and storage/driverRatings specs. What
 * only exists here is the join: which Steam ids leave the grid, that ranks are
 * read synchronously while a snapshot is built, and that an answer arriving
 * after that snapshot was published still reaches the renderer.
 */
describe('publishLmuSDKEvents and driver ratings', () => {
  const driver = (name: string) => ({ name });

  const namesRequested = () => ratingState.requested.flat();

  const sessionPublishCount = (overlayManager: OverlayManager) =>
    vi
      .mocked(overlayManager.publishMessage)
      .mock.calls.filter(([channel]) => channel === 'sessionData').length;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkState.running = true;
    sdkState.readThrows = false;
    sdkState.drivers = [];
    ratingState.requested = [];
    ratingState.onResolved = undefined;
    ratingState.tapeClientBuilt = false;
  });

  it('asks about the driver names on the grid', async () => {
    sdkState.drivers = [driver('Herve Attard'), driver('Leonel Gomez')];
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(namesRequested().length).toBeGreaterThan(0));
    expect(new Set(namesRequested())).toEqual(
      new Set(['Herve Attard', 'Leonel Gomez'])
    );

    bridge.stop();
  });

  it('sends the name as the standings spell it', async () => {
    // Same capitalisation, UTF-8 intact, with any '#' suffix and surrounding
    // padding removed -- the service matched the plain name exactly.
    sdkState.drivers = [driver('  Sébastien Rival#77 ')];
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(namesRequested().length).toBeGreaterThan(0));
    expect(namesRequested()).toContain('Sébastien Rival');

    bridge.stop();
  });

  it('leaves unnamed entries out of the lookup', async () => {
    // An empty slot is not a person. Asking about "" would fill a batch with
    // a name that cannot match and have the miss remembered against it.
    sdkState.drivers = [driver(''), driver('Herve Attard'), driver('   ')];
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(namesRequested().length).toBeGreaterThan(0));
    expect(namesRequested()).toEqual(['Herve Attard']);

    bridge.stop();
  });

  it('hands the session mapper a synchronous rating lookup', async () => {
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(mapSessionSpy).toHaveBeenCalled());
    const ratingFor = mapSessionSpy.mock.calls[0][3] as (
      steamId: string
    ) => unknown;
    expect(typeof ratingFor).toBe('function');

    // It must read through the client rather than hold a snapshot of its own,
    // or a rank resolved later would never be picked up.
    ratingFor('Herve Attard');
    expect(ratingState.get).toHaveBeenCalledWith('Herve Attard');

    bridge.stop();
  });

  it('republishes the session when a rating resolves', async () => {
    // A rating lands long after the snapshot that asked for it. The signature
    // is pinned to a constant in this file's mocks, so a second sessionData
    // publish here can only come from the client's onResolved dropping it --
    // exactly the silent failure this guards: a rank sitting in the cache,
    // never reaching the renderer.
    sdkState.drivers = [driver('Herve Attard')];
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(sessionPublishCount(overlayManager)).toBe(1));

    ratingState.onResolved?.();

    await vi.waitFor(() =>
      expect(sessionPublishCount(overlayManager)).toBeGreaterThan(1)
    );
    bridge.stop();
  });

  it('drops the token and queue when the sim is confirmed gone', async () => {
    // The token was bought with a ticket that sim run minted, and nothing
    // queued can be asked about once the sim is not there to mint another.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() =>
      expect(restState.poller.setActive).toHaveBeenCalledWith(true)
    );
    sdkState.readThrows = true;

    await vi.waitFor(() => expect(ratingState.reset).toHaveBeenCalled());
    bridge.stop();
  });

  it('flushes the rating cache on teardown', async () => {
    // Cache writes are debounced behind an unref'd timer, so without this a
    // rating resolved in the last second before a quit is simply lost.
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(ratingState.cache.load).toHaveBeenCalled());
    bridge.stop();

    expect(ratingState.cache.flush).toHaveBeenCalled();
  });
});

/**
 * Which rating source a replay gets.
 *
 * A replay cannot resolve ratings the live way: the ticket that authorises the
 * lookup is deliberately never recorded, so the live client would build a
 * cache, open an HTTPS agent, and ask the tape for a credential that is not
 * in it. The tape-backed client is the whole of what a replay needs, and
 * taking the other branch is what keeps a replay off the disk and off the
 * network entirely.
 */
describe('publishLmuSDKEvents rating source on a tape replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkState.running = true;
    sdkState.readThrows = false;
    sdkState.drivers = [];
    ratingState.requested = [];
    ratingState.tapeClientBuilt = false;
  });

  it('reads ratings from the tape instead of the service', async () => {
    vi.stubEnv('IRDASHIES_LMU_REPLAY', 'session.lmudt');
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(mapSessionSpy).toHaveBeenCalled());
    expect(ratingState.tapeClientBuilt).toBe(true);
    // No cache either: there is nothing worth persisting from a replay, and
    // loading one would let a live session's ratings into a tape's standings.
    expect(ratingState.cache.load).not.toHaveBeenCalled();

    bridge.stop();
    expect(ratingState.cache.flush).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('uses the live client when not replaying', async () => {
    const overlayManager = createOverlayManager();
    const { publishLmuSDKEvents } = await import('./lmuSdkBridge');
    const bridge = await publishLmuSDKEvents(overlayManager);

    await vi.waitFor(() => expect(ratingState.cache.load).toHaveBeenCalled());
    expect(ratingState.tapeClientBuilt).toBe(false);

    bridge.stop();
  });
});
