/**
 * A 100 Hz lap position for LMU, which only publishes one at 5 Hz.
 *
 * `mLapDist` lives solely in `LMUVehicleScoring`, and the scoring block updates
 * about five times a second. The telemetry block updates at 100 Hz but carries
 * no lap distance at all — so unlike iRacing, where `LapDistPct` arrives from
 * the sim at 60 Hz, there is no faster field to read and the value has to be
 * reconstructed.
 *
 * Between scoring updates the position is advanced by `speed × elapsed`, and
 * every scoring update resynchronises it. Drift therefore cannot accumulate: the
 * error is the second-order term over a single 200 ms window, roughly 0.2 m
 * under hard braking, against the ~14 m quantisation it replaces.
 *
 * Why this matters beyond neatness: LapTrace's sample buffer discards any sample
 * that has not advanced, so a 5 Hz position produced about five samples per
 * second — a trace far too coarse to show a braking point, which is the widget's
 * whole purpose.
 */

/**
 * Integrator state for one car. Owned by the caller and mutated in place, so the
 * estimator stays a pure function of (state, frame) and can be stepped
 * deterministically in a test.
 */
export interface LmuLapDistanceState {
  /** Scoring fraction last synchronised to; -1 when nothing is known yet. */
  syncedPct: number;
  /** `mElapsedTime` at that synchronisation. */
  syncedAt: number;
  /** Lap number at that synchronisation, so a new lap forces a hard resync. */
  syncedLap: number;
  /** Last value handed out, held monotonic so no consumer ever sees a step back. */
  lastPct: number;
}

export const createLmuLapDistanceState = (): LmuLapDistanceState => ({
  syncedPct: -1,
  syncedAt: -1,
  syncedLap: -1,
  lastPct: -1,
});

export const resetLmuLapDistanceState = (state: LmuLapDistanceState): void => {
  state.syncedPct = -1;
  state.syncedAt = -1;
  state.syncedLap = -1;
  state.lastPct = -1;
};

/**
 * Longest stretch that may be integrated before falling back to scoring.
 *
 * Normally a scoring update lands every ~200 ms. A longer gap means something
 * stalled — a pause, a menu, a dropped frame — and integrating across it would
 * invent position from a stale speed.
 */
const MAX_INTEGRATION_SEC = 0.5;

/**
 * A backward jump in the scoring fraction larger than this is a real
 * discontinuity — a lap boundary the lap counter has not caught up with, a spin,
 * a tow, or a replay scrub — and breaks the monotonic hold rather than being
 * smoothed over. 0.5% of a lap is ~35 m on a 7 km circuit, far beyond any
 * integration error.
 */
const DISCONTINUITY_PCT = 0.005;

export interface LmuLapDistanceFrame {
  /** The 5 Hz scoring fraction, 0..1, or negative when unknown. */
  scoringPct: number;
  /** Player telemetry clock, seconds, 100 Hz. */
  elapsedTime: number;
  /** Lap number from telemetry (100 Hz), so a boundary is seen immediately. */
  lapNumber: number;
  /** Speed in m/s, 100 Hz. Always positive: it is a velocity magnitude. */
  speedMs: number;
  trackLengthM: number;
}

/**
 * The best available lap fraction for this frame, 0..1.
 *
 * Falls back to the scoring value whenever integration cannot be trusted, so the
 * worst case is exactly today's behaviour.
 */
export function estimateLmuLapDistPct(
  state: LmuLapDistanceState,
  frame: LmuLapDistanceFrame
): number {
  const { scoringPct, elapsedTime, lapNumber, speedMs, trackLengthM } = frame;

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  // Nothing usable: hand back what scoring said and forget any history.
  if (
    !(trackLengthM > 0) ||
    !Number.isFinite(scoringPct) ||
    scoringPct < 0 ||
    !Number.isFinite(elapsedTime)
  ) {
    resetLmuLapDistanceState(state);
    return scoringPct >= 0 ? clamp(scoringPct) : scoringPct;
  }

  const hardResync =
    state.syncedPct < 0 ||
    lapNumber !== state.syncedLap ||
    scoringPct < state.syncedPct - DISCONTINUITY_PCT ||
    elapsedTime < state.syncedAt;

  if (hardResync) {
    state.syncedPct = scoringPct;
    state.syncedAt = elapsedTime;
    state.syncedLap = lapNumber;
    state.lastPct = clamp(scoringPct);
    return state.lastPct;
  }

  // Scoring moved on: adopt it as the new anchor. It is authoritative, and this
  // is what keeps the integration from drifting.
  if (scoringPct !== state.syncedPct) {
    state.syncedPct = scoringPct;
    state.syncedAt = elapsedTime;
  }

  const dt = elapsedTime - state.syncedAt;
  if (!(dt >= 0) || dt > MAX_INTEGRATION_SEC || !Number.isFinite(speedMs)) {
    // Stop integrating, but hold rather than step back. The point of this
    // branch is not to project a stale speed; dropping to the frozen scoring
    // value would also undo whatever the estimate had already led it by, and
    // at racing speed half a second of lead is tens of metres -- far enough
    // to reach the sample buffer as a reversal and mark the lap dirty.
    // Freezing costs dropped samples, which is harmless; stepping back costs
    // the reference lap, silently.
    //
    // A genuine backward move is not affected: a lap change or a jump beyond
    // DISCONTINUITY_PCT is caught by the hard resync above, before here.
    state.lastPct = Math.max(state.lastPct, clamp(scoringPct));
    return state.lastPct;
  }

  const travelled = Math.max(0, speedMs) * dt;
  const estimated = clamp(state.syncedPct + travelled / trackLengthM);

  // Held monotonic within a lap. The estimate can lead the next scoring update
  // by a few centimetres, and letting it drop back would feed the sample buffer
  // a backward step, which marks the lap dirty.
  state.lastPct = Math.max(state.lastPct, estimated);
  return state.lastPct;
}
