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
   * `mElapsedTime` when scoring dropped to exactly 0 while the estimate was
   * still short of the line, or -1. That is scoring held at its own line
   * rather than a position past it, so the old lap carries on until scoring
   * moves, advanced frame by frame from `syncedPct`.
   */
  heldAtLineSince: number;
  /**
   * The lap number that goes with the position: advanced in the frame the
   * position wraps, and taken from the sim's counter while the car is
   * mid-lap. Null until the sim has reported one.
   */
  lap: number | null;
  /** The sim's counter on the last frame, to see it go backwards. */
  lastLapNumber: number;
  /**
   * Completed laps minus the lap counter, as seen mid-lap, where the two
   * agree; see `lmuCompletedLaps`.
   */
  completedOffset: number;
}

export const createLmuLapDistanceState = (): LmuLapDistanceState => ({
  syncedPct: -1,
  syncedAt: -1,
  lastScoringPct: -1,
  lastPct: -1,
  heldAtLineSince: -1,
  lap: null,
  lastLapNumber: -1,
  completedOffset: 0,
});

export const resetLmuLapDistanceState = (state: LmuLapDistanceState): void => {
  state.syncedPct = -1;
  state.syncedAt = -1;
  state.lastScoringPct = -1;
  state.lastPct = -1;
  state.heldAtLineSince = -1;
  state.lap = null;
  state.lastLapNumber = -1;
  state.completedOffset = 0;
};

/**
 * Completed laps to go with the position, or null when unknown: the sim's own
 * count moved in the frame the position wraps, as `lap` is. Lap plus fraction
 * is how standings and race projections measure progress, and a count that
 * moved at the timing line while the fraction wrapped later put every car a
 * lap ahead for that stretch, or a lap behind when the fraction ran over the
 * line ahead of scoring.
 */
export const lmuCompletedLaps = (state: LmuLapDistanceState): number | null =>
  state.lap === null ? null : state.lap + state.completedOffset;

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
  /**
   * The sim's completed-lap count, if it publishes one beside the counter;
   * seeds `lmuCompletedLaps`.
   */
  completedLaps?: number;
  /** Speed in m/s, 100 Hz. Always positive: it is a velocity magnitude. */
  speedMs: number;
  trackLengthM: number;
}

/*
 * Plain functions rather than closures inside the estimator: it runs for the
 * player and every opponent on every poll, and a closure per call would
 * allocate where nothing else on that path does.
 */

function clampPct(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Start again from scoring, as on the first frame. */
function anchorToScoring(
  state: LmuLapDistanceState,
  frame: LmuLapDistanceFrame
): number {
  state.syncedPct = frame.scoringPct;
  state.syncedAt = frame.elapsedTime;
  state.lastScoringPct = frame.scoringPct;
  state.lastPct = clampPct(frame.scoringPct);
  state.heldAtLineSince = -1;
  state.lap = frame.lapNumber >= 0 ? frame.lapNumber : null;
  state.lastLapNumber = frame.lapNumber;
  // From this frame too, as the lap is. Left to the first mid-lap frame, an
  // anchor near the line published the counter as the completed count, and
  // the correction later could step it backwards.
  const completed = frame.completedLaps;
  state.completedOffset =
    frame.lapNumber >= 0 &&
    completed !== undefined &&
    Number.isFinite(completed) &&
    completed >= 0
      ? completed - frame.lapNumber
      : 0;
  return state.lastPct;
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

  // Nothing usable: hand back what scoring said and forget any history.
  if (
    !(trackLengthM > 0) ||
    !Number.isFinite(scoringPct) ||
    scoringPct < 0 ||
    !Number.isFinite(elapsedTime)
  ) {
    resetLmuLapDistanceState(state);
    return scoringPct >= 0 ? clampPct(scoringPct) : scoringPct;
  }

  // Nothing to advance from yet, or the clock went back: a session restart or
  // a replay scrub. Either way nothing before it describes the car now.
  if (state.syncedPct < 0 || elapsedTime < state.syncedAt) {
    return anchorToScoring(state, frame);
  }

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
        // Carried on from where the estimate is now, and from here advanced
        // a frame at a time: scoring may hold for seconds, and one speed
        // applied to all of that would invent the distance.
        const dt = elapsedTime - state.syncedAt;
        if (dt >= 0 && dt <= MAX_INTEGRATION_SEC && Number.isFinite(speedMs)) {
          state.lastPct = Math.max(
            state.lastPct,
            state.syncedPct + (Math.max(0, speedMs) * dt) / trackLengthM
          );
        }
        state.syncedPct = state.lastPct;
        state.syncedAt = elapsedTime;
        state.heldAtLineSince = elapsedTime;
      } else {
        // Measured from the new lap now. An estimate that already ran over
        // the line keeps its lead, monotonic as ever.
        state.lastPct = ranOver
          ? Math.max(state.lastPct - 1, scoringPct)
          : scoringPct;
        state.syncedPct = scoringPct;
        state.syncedAt = elapsedTime;
        state.heldAtLineSince = -1;
      }
    } else if (scoringPct < state.syncedPct - DISCONTINUITY_PCT) {
      // A real backward move -- a tow, a reset, a restart -- not the run to
      // the line. Scoring is the truth.
      return anchorToScoring(state, frame);
    } else {
      // Scoring moved on: adopt it as the new anchor. It is authoritative,
      // and this is what keeps the integration from drifting.
      state.syncedPct = scoringPct;
      state.syncedAt = elapsedTime;
      state.heldAtLineSince = -1;
    }
  }

  const dt = elapsedTime - state.syncedAt;
  const held = state.heldAtLineSince >= 0;
  if (held && elapsedTime - state.heldAtLineSince > HELD_AT_LINE_MAX_SEC) {
    // Held at the line for longer than any gap takes to drive: take
    // scoring's 0 after all.
    state.heldAtLineSince = -1;
    state.syncedPct = 0;
    state.syncedAt = elapsedTime;
    if (state.lastPct >= 1) state.lastPct -= 1;
    else state.lastPct = 0;
  } else if (
    !(dt >= 0) ||
    dt > MAX_INTEGRATION_SEC ||
    !Number.isFinite(speedMs)
  ) {
    if (held) {
      // A stall while held: skip it rather than integrate across it.
      state.syncedAt = elapsedTime;
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
    if (held) {
      // Held at the line, the anchor moves with each frame, so each frame's
      // speed covers only its own time.
      state.syncedPct = estimated;
      state.syncedAt = elapsedTime;
    }
  }

  const after = state.lastPct >= 1 ? state.lastPct - 1 : state.lastPct;

  // The lap number moves in the same frame as the position wraps, so nothing
  // pairing the two sees the line twice. Mid-lap the sim's counter is right
  // whatever happened at the line, so any disagreement there is settled. So
  // is the counter going backwards, or apart by more than the line can
  // explain: a session rolled or restarted, wherever on the lap the car is.
  const counterReset =
    lapNumber >= 0 &&
    state.lap !== null &&
    ((state.lastLapNumber >= 0 && lapNumber < state.lastLapNumber) ||
      Math.abs(lapNumber - state.lap) > 1);
  if (
    lapNumber >= 0 &&
    (counterReset || (after >= MID_LAP_FROM && after <= MID_LAP_TO))
  ) {
    state.lap = lapNumber;
    const completed = frame.completedLaps;
    if (
      !counterReset &&
      completed !== undefined &&
      Number.isFinite(completed) &&
      completed >= 0
    ) {
      state.completedOffset = completed - lapNumber;
    }
  } else if (before > 0.5 && after < 0.5 && state.lap !== null) {
    state.lap += 1;
  } else if (state.lap === null && lapNumber >= 0) {
    state.lap = lapNumber;
  }
  state.lastLapNumber = lapNumber;

  return clampPct(after);
}
