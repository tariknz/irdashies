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
 *
 * The line is scoring's. LMU's 100 Hz lap counter flips at the timing line,
 * which need not be where scoring's distance wraps: 1.6 m before it at Laguna
 * Seca and Fuji, and further where the start and finish lines are apart.
 * Steering the distance by that counter was what made it jump at the line, or
 * cross it twice. So the counter plays no part in the position; it only seeds
 * the lap number published beside it (see `lap`).
 */

/**
 * Integrator state for one car. Owned by the caller and mutated in place, so the
 * estimator stays a pure function of (state, frame) and can be stepped
 * deterministically in a test.
 */
export interface LmuLapDistanceState {
  /** Scoring fraction the estimate is advanced from; -1 when nothing is known. */
  syncedPct: number;
  /** `mElapsedTime` at that synchronisation. */
  syncedAt: number;
  /** The last scoring fraction seen, so an update is told from a repeat. */
  lastScoringPct: number;
  /**
   * Last position handed out, measured on `syncedPct`'s lap: past 1 once the
   * estimate has run over the line ahead of scoring's own wrap. Held
   * monotonic so no consumer ever sees a step back.
   */
  lastPct: number;
  /**
   * Scoring dropped to exactly 0 while the estimate was still short of the
   * line. That is scoring held at its own line rather than a position past
   * it, so the old lap carries on from `syncedPct` until scoring moves.
   */
  heldAtLine: boolean;
  /**
   * The lap number that goes with the position: advanced in the frame the
   * position wraps, and taken from the sim's counter while the car is
   * mid-lap. Null until the sim has reported one.
   */
  lap: number | null;
}

export const createLmuLapDistanceState = (): LmuLapDistanceState => ({
  syncedPct: -1,
  syncedAt: -1,
  lastScoringPct: -1,
  lastPct: -1,
  heldAtLine: false,
  lap: null,
});

export const resetLmuLapDistanceState = (state: LmuLapDistanceState): void => {
  state.syncedPct = -1;
  state.syncedAt = -1;
  state.lastScoringPct = -1;
  state.lastPct = -1;
  state.heldAtLine = false;
  state.lap = null;
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
 * discontinuity — a spin, a tow, a session restart or a replay scrub — and
 * breaks the monotonic hold rather than being smoothed over. 0.5% of a lap is
 * ~35 m on a 7 km circuit, far beyond any integration error.
 */
const DISCONTINUITY_PCT = 0.005;

/**
 * How far short of the line scoring may read exactly 0 and still be taken as
 * held at its own line. 5% of a lap: wide enough for separate start and finish
 * lines, and the same share LapTrace treats as the end of a lap.
 */
const LINE_GAP_MAX_PCT = 0.05;

/**
 * How long the old lap may be carried while scoring is held at its line. Long
 * enough to drive the widest gap slowly; beyond it scoring's 0 is taken.
 */
const HELD_AT_LINE_MAX_SEC = 30;

/** Mid-lap, the sim's own lap counter is the lap number. */
const MID_LAP_FROM = 0.1;
const MID_LAP_TO = 0.9;

export interface LmuLapDistanceFrame {
  /** The 5 Hz scoring fraction, 0..1, or negative when unknown. */
  scoringPct: number;
  /** Player telemetry clock, seconds, 100 Hz. */
  elapsedTime: number;
  /** The sim's lap counter, which seeds `lap`; negative when unknown. */
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

  /** Start again from scoring, as on the first frame. */
  const anchor = (): number => {
    state.syncedPct = scoringPct;
    state.syncedAt = elapsedTime;
    state.lastScoringPct = scoringPct;
    state.lastPct = clamp(scoringPct);
    state.heldAtLine = false;
    state.lap = lapNumber >= 0 ? lapNumber : null;
    return state.lastPct;
  };

  // Nothing to advance from yet, or the clock went back: a session restart or
  // a replay scrub. Either way nothing before it describes the car now.
  if (state.syncedPct < 0 || elapsedTime < state.syncedAt) return anchor();

  const before = state.lastPct >= 1 ? state.lastPct - 1 : state.lastPct;

  if (scoringPct !== state.lastScoringPct) {
    state.lastScoringPct = scoringPct;
    const ranOver = state.lastPct >= 1;
    if (state.syncedPct - scoringPct > 0.5) {
      // Scoring wrapped: the new lap. Exactly 0 just short of the line is
      // scoring held at its own line, not past it; the old lap carries on.
      // Taking that 0 jumped the car forward by the gap, then held it when
      // the next update came back behind.
      const shortOfLineM = (1 - state.lastPct) * trackLengthM;
      if (
        scoringPct === 0 &&
        !ranOver &&
        shortOfLineM <= LINE_GAP_MAX_PCT * trackLengthM
      ) {
        state.heldAtLine = true;
      } else {
        // Measured from the new lap now. An estimate that already ran over
        // the line keeps its lead, monotonic as ever.
        state.lastPct = ranOver
          ? Math.max(state.lastPct - 1, scoringPct)
          : scoringPct;
        state.syncedPct = scoringPct;
        state.syncedAt = elapsedTime;
        state.heldAtLine = false;
      }
    } else if (scoringPct < state.syncedPct - DISCONTINUITY_PCT) {
      // A real backward move -- a tow, a reset, a restart -- not the run to
      // the line. Scoring is the truth.
      return anchor();
    } else {
      // Scoring moved on: adopt it as the new anchor. It is authoritative,
      // and this is what keeps the integration from drifting.
      state.syncedPct = scoringPct;
      state.syncedAt = elapsedTime;
      state.heldAtLine = false;
    }
  }

  const dt = elapsedTime - state.syncedAt;
  const limit = state.heldAtLine ? HELD_AT_LINE_MAX_SEC : MAX_INTEGRATION_SEC;
  if (!(dt >= 0) || dt > limit || !Number.isFinite(speedMs)) {
    if (state.heldAtLine && dt > limit) {
      // Held at the line for longer than any gap takes to drive: take
      // scoring's 0 after all.
      state.heldAtLine = false;
      state.syncedPct = 0;
      state.syncedAt = elapsedTime;
      if (state.lastPct >= 1) state.lastPct -= 1;
      else state.lastPct = 0;
    } else if (state.syncedPct >= state.lastPct) {
      // Stop integrating, but hold rather than step back. The point of this
      // branch is not to project a stale speed; dropping to the frozen
      // scoring value would also undo whatever the estimate had already led
      // it by, and at racing speed half a second of lead is tens of metres --
      // far enough to reach the sample buffer as a reversal and mark the lap
      // dirty. Freezing costs dropped samples, which is harmless; stepping
      // back costs the reference lap, silently.
      state.lastPct = state.syncedPct;
    }
  } else {
    // Held monotonic within a lap. The estimate can lead the next scoring
    // update by a few centimetres, and letting it drop back would feed the
    // sample buffer a backward step, which marks the lap dirty.
    //
    // Not clamped at the line: running over it starts the next lap at once
    // rather than standing still until scoring's next update wraps. Bounded
    // by one integration window, so the lead is a few metres at most.
    const estimated =
      state.syncedPct + (Math.max(0, speedMs) * dt) / trackLengthM;
    state.lastPct = Math.min(2, Math.max(state.lastPct, estimated));
  }

  const after = state.lastPct >= 1 ? state.lastPct - 1 : state.lastPct;

  // The lap number moves in the same frame as the position wraps, so nothing
  // pairing the two sees the line twice. Mid-lap the sim's counter is right
  // whatever happened at the line, so any disagreement there is settled.
  if (after >= MID_LAP_FROM && after <= MID_LAP_TO) {
    if (lapNumber >= 0) state.lap = lapNumber;
  } else if (before > 0.5 && after < 0.5 && state.lap !== null) {
    state.lap += 1;
  } else if (state.lap === null && lapNumber >= 0) {
    state.lap = lapNumber;
  }

  return clamp(after);
}
