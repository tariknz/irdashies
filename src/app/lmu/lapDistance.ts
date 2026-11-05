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
   * `mElapsedTime` when a new lap was anchored at zero ahead of scoring's wrap,
   * or -1. Until scoring wraps, its value still belongs to the old lap and must
   * not become the anchor; see estimateLmuLapDistPct.
   */
  awaitingWrapSince: number;
  /**
   * Scoring's fraction on the frame the lap counter flipped. Scoring can
   * already read 0 there, wrapped but not yet past its own line, and that
   * value is not adopted either: only the next scoring update is.
   */
  scoringAtTurnover: number;
}

export const createLmuLapDistanceState = (): LmuLapDistanceState => ({
  syncedPct: -1,
  syncedAt: -1,
  syncedLap: -1,
  lastPct: -1,
  awaitingWrapSince: -1,
  scoringAtTurnover: -1,
});

export const resetLmuLapDistanceState = (state: LmuLapDistanceState): void => {
  state.syncedPct = -1;
  state.syncedAt = -1;
  state.syncedLap = -1;
  state.lastPct = -1;
  state.awaitingWrapSince = -1;
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
 * How far short of the line the estimate may be when the lap counter flips and
 * still be carried across it rather than snapped to zero.
 *
 * The two do not agree on where the line is. LMU's lap counter flips about
 * 1.6 m before scoring's distance reaches the end of the lap -- measured at
 * Laguna Seca and Fuji, at different speeds -- and the estimate follows
 * scoring. Snapping to zero at the flip showed as the plot jumping forward at
 * the line and then standing still when scoring wrapped. A shortfall beyond
 * this is not that offset but a stale estimate, and zero is the better guess.
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
    // The lap counter increments a little before scoring's percentage wraps,
    // so for those few frames lapNumber says "new lap" while scoringPct still
    // reads ~0.99. Anchoring the new lap up there meant the estimate started
    // the lap at 99% and then fell to zero when scoring caught up -- a
    // backwards step large enough for LapTrace's jump detection to read as
    // impossible, which discarded the partial lap and began a dirty one.
    //
    // So a new lap is measured from the line until scoring's next update. The
    // first frame of all is excluded: there is no previous lap to have changed
    // from, and scoring's value is the only truth available.
    state.syncedLap = lapNumber;
    state.awaitingWrapSince = -1;
    if (lapChanged) {
      // Where the old lap's estimate is now. Usually a metre or two short of
      // the line (see LINE_OFFSET_TOLERANCE_M): it carries on from there
      // rather than jumping to zero, and starts the new lap when it reaches
      // the line. Further out, the new lap starts at zero.
      //
      // Carried too when scoring has wrapped on this same frame but reads
      // exactly 0: held at its own line, not yet past it. Anchoring there
      // jumped the car forward by the offset and held it on the next update,
      // as snapping to zero did. A wrapped reading above zero is a real
      // position past the line, and is the anchor as before.
      const dtOld = elapsedTime - state.syncedAt;
      const oldPct =
        dtOld >= 0 && dtOld <= MAX_INTEGRATION_SEC && Number.isFinite(speedMs)
          ? state.syncedPct + (Math.max(0, speedMs) * dtOld) / trackLengthM
          : state.lastPct;
      const offLineM = Math.abs(1 - oldPct) * trackLengthM;
      const carry = offLineM <= LINE_OFFSET_TOLERANCE_M;
      if (scoringPct > 0.5 || (carry && scoringPct === 0)) {
        state.syncedPct = carry ? oldPct - 1 : 0;
        state.syncedAt = elapsedTime;
        state.awaitingWrapSince = elapsedTime;
        state.scoringAtTurnover = scoringPct;
        return carryAcrossLine(state.syncedPct);
      }
    }
    state.syncedPct = scoringPct;
    state.syncedAt = elapsedTime;
    state.lastPct = clamp(scoringPct);
    return state.lastPct;
  }

  // Still waiting for scoring's first update of the new lap. Before it, its
  // ~0.99 is the old lap's, and adopting it as the anchor below undid the new
  // lap on the very next frame: the estimate went back to 99%, reached 100% --
  // a second start/finish crossing -- and LapTrace dropped the lap it had just
  // finished before its official time arrived. Integrate from the line
  // instead.
  //
  // Bounded by one integration window: scoring wraps within a single 200 ms
  // update, so a lap change it still disagrees with after that is something
  // else -- a tow, a reset -- and scoring is the truth again.
  if (state.awaitingWrapSince >= 0) {
    const stillOldLap =
      (scoringPct > 0.5 || scoringPct === state.scoringAtTurnover) &&
      elapsedTime - state.awaitingWrapSince <= MAX_INTEGRATION_SEC;
    if (stillOldLap) {
      const dt = Math.max(0, elapsedTime - state.syncedAt);
      const speed = Number.isFinite(speedMs) ? Math.max(0, speedMs) : 0;
      return carryAcrossLine(state.syncedPct + (speed * dt) / trackLengthM);
    }
    state.awaitingWrapSince = -1;
    // Scoring wrapped before the carried estimate reached the line: the new
    // lap starts now, so what was handed out on the old one must not hold it.
    if (scoringPct <= 0.5 && state.lastPct > 0.5) state.lastPct = 0;
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
