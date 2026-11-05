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
  /**
   * True from the lap counter flipping until scoring wraps. In between,
   * `syncedPct` is measured from the line -- negative while short of it -- and
   * scoring's values still belong to the old lap; see estimateLmuLapDistPct.
   */
  awaitingWrap: boolean;
  /**
   * The scoring fraction last taken as an anchor while awaiting the wrap, so
   * the same value is not taken twice. On the flip frame it can already read
   * 0, wrapped but not yet past its own line, and is not adopted as a wrap.
   */
  scoringAtTurnover: number;
}

export const createLmuLapDistanceState = (): LmuLapDistanceState => ({
  syncedPct: -1,
  syncedAt: -1,
  syncedLap: -1,
  lastPct: -1,
  awaitingWrap: false,
  scoringAtTurnover: -1,
});

export const resetLmuLapDistanceState = (state: LmuLapDistanceState): void => {
  state.syncedPct = -1;
  state.syncedAt = -1;
  state.syncedLap = -1;
  state.lastPct = -1;
  state.awaitingWrap = false;
  state.scoringAtTurnover = -1;
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

/**
 * How far short of the line the estimate may be, when the lap counter flips
 * with scoring already reading exactly 0, for that 0 to be read as scoring
 * held at its own line rather than as a position past it.
 *
 * The counter and scoring do not agree on where the line is: at Laguna Seca
 * and Fuji the counter flips about 1.6 m before scoring's distance wraps.
 */
const LINE_OFFSET_TOLERANCE_M = 10;

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

  /**
   * The value to hand out while a new lap waits for scoring to wrap, from its
   * position on the new lap: negative while still short of the line.
   *
   * Short of the line, the old lap continues; at or past it, the new lap
   * starts. Monotonic either way, and never back from the new lap to the old.
   */
  const carryAcrossLine = (newLapPct: number): number => {
    const onOldLap = state.lastPct > 0.5;
    if (newLapPct < 0) {
      if (onOldLap)
        state.lastPct = Math.max(state.lastPct, clamp(1 + newLapPct));
      return state.lastPct;
    }
    state.lastPct = onOldLap
      ? clamp(newLapPct)
      : Math.max(state.lastPct, clamp(newLapPct));
    return state.lastPct;
  };

  // -1 is the "nothing known yet" sentinel. A lap carried across the line
  // anchors a little below zero, so the test is not `>= 0`.
  const anchored = state.syncedPct > -0.5;

  // A genuine lap change, as opposed to the first frame we have ever seen.
  const lapChanged = anchored && lapNumber !== state.syncedLap;

  const hardResync =
    !anchored ||
    lapChanged ||
    scoringPct < state.syncedPct - DISCONTINUITY_PCT ||
    elapsedTime < state.syncedAt;

  if (hardResync) {
    // LMU's lap counter and scoring's distance do not agree on where the line
    // is. The counter flips first -- about 1.6 m first at Laguna Seca and
    // Fuji, and evidently much further at a circuit whose start and finish
    // lines are apart -- so for a while lapNumber says "new lap" while
    // scoringPct still reads ~0.99.
    //
    // Anchoring the new lap at scoring's 0.99 started it at 99% and fell back
    // to zero when scoring wrapped, a reversal LapTrace reads as impossible.
    // Snapping to zero instead jumped the car forward by the gap, and once the
    // gap took longer to drive than the estimator would wait, fell back to the
    // old lap and crossed the line a second time, replaying the same metres.
    //
    // So the flip only starts the wait. The old lap carries on, following
    // scoring as usual, and the new lap begins where scoring wraps, wherever
    // that is. The first frame of all is excluded: there is no previous lap
    // to have changed from, and scoring's value is the only truth available.
    state.syncedLap = lapNumber;
    state.awaitingWrap = false;
    if (lapChanged) {
      // Where the old lap is now: scoring itself if it has just updated,
      // otherwise the estimate projected to this frame.
      const dtOld = elapsedTime - state.syncedAt;
      const oldPct =
        scoringPct > 0.5 && scoringPct !== state.syncedPct
          ? scoringPct
          : dtOld >= 0 &&
              dtOld <= MAX_INTEGRATION_SEC &&
              Number.isFinite(speedMs)
            ? state.syncedPct + (Math.max(0, speedMs) * dtOld) / trackLengthM
            : state.lastPct;
      // Scoring reading exactly 0 on this frame has wrapped but is held at its
      // own line, not past it, when the estimate says the line is a metre or
      // two away; a 0 from further out, or anything above it, is a real
      // position on the new lap.
      const heldAtLine =
        scoringPct === 0 &&
        Math.abs(1 - oldPct) * trackLengthM <= LINE_OFFSET_TOLERANCE_M;
      if (scoringPct > 0.5 || heldAtLine) {
        state.syncedPct = oldPct - 1;
        state.syncedAt = elapsedTime;
        state.awaitingWrap = true;
        state.scoringAtTurnover = scoringPct;
        return carryAcrossLine(state.syncedPct);
      }
    }
    state.syncedPct = scoringPct;
    state.syncedAt = elapsedTime;
    state.lastPct = clamp(scoringPct);
    return state.lastPct;
  }

  // Between the lap counter flipping and scoring wrapping. Scoring's values
  // are the old lap's, measured here from the line as value - 1, and each new
  // one is adopted as the anchor exactly as on any other frame -- adopting
  // them as they stand undid the new lap on the next frame, and the estimate
  // crossed the line twice. No time limit: however long the gap takes to
  // drive, scoring keeps the position honest until it wraps.
  if (state.awaitingWrap) {
    const wrapped = scoringPct <= 0.5 && scoringPct !== state.scoringAtTurnover;
    if (!wrapped) {
      if (scoringPct > 0.5 && scoringPct !== state.scoringAtTurnover) {
        const fromLine = scoringPct - 1;
        if (fromLine < state.syncedPct - DISCONTINUITY_PCT) {
          // Scoring went well back on the old lap: a tow or a reset, not the
          // run to the line. That is the truth, and the wait is over.
          state.awaitingWrap = false;
          state.syncedPct = scoringPct;
          state.syncedAt = elapsedTime;
          state.lastPct = clamp(scoringPct);
          return state.lastPct;
        }
        state.syncedPct = fromLine;
        state.syncedAt = elapsedTime;
        state.scoringAtTurnover = scoringPct;
      }
      const dt = elapsedTime - state.syncedAt;
      if (!(dt >= 0) || dt > MAX_INTEGRATION_SEC || !Number.isFinite(speedMs)) {
        // Stalled, as below: hold rather than project a stale speed.
        return state.lastPct;
      }
      return carryAcrossLine(
        state.syncedPct + (Math.max(0, speedMs) * dt) / trackLengthM
      );
    }
    state.awaitingWrap = false;
    // Scoring wrapped before the carried estimate reached the line: the new
    // lap starts now, so what was handed out on the old one must not hold it.
    if (state.lastPct > 0.5) state.lastPct = 0;
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
