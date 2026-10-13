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
}));

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
    readSession = vi.fn(() => ({ ...rawFrame(), classes: [], drivers: [] }));
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
  mapLmuSession: () => ({ drivers: [] }),
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
