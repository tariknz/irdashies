/**
 * The brake-countdown state machine.
 *
 * Both outputs — the bar strip and the audio cues — are driven by one integer
 * `level`, never by the raw predicted seconds:
 *
 *   4  >3s away   4 bars, green
 *   3   3s        3 bars, green    fires count3
 *   2   2s        2 bars, amber    fires count2
 *   1   1s        1 bar,  orange   fires count1
 *   0   at/past   1 bar,  RED      fires brake
 *
 * A point acquired when it is already inside the ladder never gets the counts —
 * only the beep for the point itself. That is the second half of a chicane,
 * reached while still braking for the first: there is no room to count down to
 * it, and three beeps crammed behind the last one say nothing. See `brakeOnly`.
 *
 * **While a target is held, `level` may only ever decrease.** That one rule is
 * what makes the feature usable. The prediction is distance/speed, so lifting
 * at 1.0 s out stretches the estimate back towards 1.7 s; any threshold test
 * with hysteresis would re-fire count1 and bounce a bar back on. Monotonicity
 * makes every cue fire at most once per approach by construction, and kills bar
 * flicker with the same mechanism. A skipped level fires only the level actually
 * entered — you cannot un-miss a beep.
 *
 * Acquisition and tracking are deliberately separate: the next point is searched
 * for only when there is no target, and thereafter the machine tracks the
 * remembered target. A per-frame search could not represent "at or just past the
 * point" at all, because the point drops out of a forward search the instant you
 * reach it and the estimate jumps to the next one.
 *
 * The continuous fill (`progress`, used by the top/bottom bar style) gets the
 * same protection against a speed-driven estimate, but by freezing its span
 * rather than its level: see `progressArmDistanceM` below.
 */

import type { BrakeCueSound, BrakeCueTone } from '@irdashies/types';
import {
  MIN_EVENT_SPACING_M,
  nextEventIndex,
  signedLapDelta,
} from './pedalEvents';

/** Longest lead time the ladder shows anything for. */
export const BRAKE_CUE_ARM_SEC = 5;

/** Below this the countdown is meaningless — nobody is braking for anything. */
export const MIN_CUE_SPEED_MS = 3;

/** How far ahead a target is looked for. */
export const BRAKE_CUE_LOOKAHEAD_M = 400;

/** Sim-time the red "brake now" state is held before clearing. */
export const BRAKE_CUE_HOLD_SEC = 1.0;

/** Distance past the point that clears the red state regardless of hold time. */
export const BRAKE_CUE_RELEASE_M = 60;

/** A lap driven slower than this fraction of the reference is not a hot lap. */
export const BRAKE_CUE_MIN_PACE_RATIO = 0.6;

/** Backward movement in one tick that means a tow, reset or spin. */
const JUMP_BACK_M = 5;

/** Forward movement in one tick no car can achieve — a teleport. */
const JUMP_FORWARD_M = 200;

const SOUND_FOR_LEVEL: Record<number, BrakeCueSound> = {
  3: 'count3',
  2: 'count2',
  1: 'count1',
  0: 'brake',
};

const TONE_FOR_LEVEL: Record<number, BrakeCueTone> = {
  4: 'green',
  3: 'green',
  2: 'amber',
  1: 'orange',
  0: 'red',
};

export interface BrakeCueLatchState {
  /** Metres of the point being approached; NaN when unarmed. */
  targetM: number;
  /** Monotone ladder. Only ever decreases while a target is held. */
  level: number;
  /** Monotone audio ladder, offset earlier by the configured lead time. */
  audioLevel: number;
  /** Level the current target was armed at, so a late arm gets no brake tone. */
  armedAtLevel: number;
  /**
   * The target was already inside the countdown window when it was acquired,
   * so there was never room for the ladder: the beep for the point still
   * fires, the counts leading up to it do not. See the acquisition below.
   */
  brakeOnly: boolean;
  /** sessionTime the red hold expires; NaN when not holding. */
  holdUntilTime: number;
  /** Point released most recently — blocks immediate re-acquisition. */
  lastReleasedM: number;
  prevDistanceM: number;
  prevSessionTime: number;
  /** Arm the next target at its current level without firing, after a reset. */
  silentArm: boolean;
  /**
   * Metres corresponding to BRAKE_CUE_ARM_SEC at the speed the instant the
   * strip first became visible for the current target. Frozen from then on,
   * so a later change in speed cannot move the fill bar's 0% point —
   * `progress` can then only rise as the car gets spatially closer, and only
   * fall if the car actually moves back away from the target. NaN until the
   * strip is first shown for the currently held target.
   */
  progressArmDistanceM: number;
}

export interface BrakeCueOutput {
  /** 0 = strip hidden, 1..4 = bars lit. */
  bars: number;
  tone: BrakeCueTone;
  /** Cue to play this frame, or null. Never repeats within an approach. */
  fire: BrakeCueSound | null;
  /**
   * Metres remaining to the target, clamped to 0 once at/past it. NaN
   * whenever `bars` is 0 — there is nothing to read a distance off.
   */
  distanceM: number;
  /**
   * 0 the instant the strip first becomes visible, up to 1 at the target,
   * held at 1 through the red hold. The 0% span is frozen at first display
   * (`progressArmDistanceM`) rather than recomputed from live speed, so it
   * reflects the car's spatial approach to the target and does not collapse
   * if the driver slows down mid-approach. 0 whenever `bars` is 0.
   */
  progress: number;
}

export interface BrakeCueTick {
  carDistanceM: number;
  speedMs: number;
  sessionTime: number;
  trackLengthM: number;
  cuePointsM: Float32Array | undefined;
  cuePointCount: number;
  /** Reference speed at the car's position, m/s. 0 disables the pace gate. */
  referenceSpeedMs: number;
  /** Seconds to advance every audio cue, clamped to the Settings range. */
  audioCueLeadSec?: number;
  /** false when off track, on pit road, in a replay, or with no reference. */
  driving: boolean;
}

/** Bars for a countdown in seconds. -1 when nothing should show yet. */
export function levelForSeconds(sec: number): number {
  if (!(sec <= BRAKE_CUE_ARM_SEC)) return -1; // also catches NaN and Infinity
  if (sec > 3) return 4;
  if (sec > 2) return 3;
  if (sec > 1) return 2;
  if (sec > 0) return 1;
  return 0;
}

export function createBrakeCueLatch(): BrakeCueLatchState {
  return {
    targetM: NaN,
    level: -1,
    audioLevel: -1,
    armedAtLevel: -1,
    brakeOnly: false,
    holdUntilTime: NaN,
    lastReleasedM: NaN,
    prevDistanceM: NaN,
    prevSessionTime: NaN,
    silentArm: true,
    progressArmDistanceM: NaN,
  };
}

export function createBrakeCueOutput(): BrakeCueOutput {
  return { bars: 0, tone: 'off', fire: null, distanceM: NaN, progress: 0 };
}

export function resetBrakeCueLatch(state: BrakeCueLatchState): void {
  state.targetM = NaN;
  state.level = -1;
  state.audioLevel = -1;
  state.armedAtLevel = -1;
  state.brakeOnly = false;
  state.holdUntilTime = NaN;
  state.lastReleasedM = NaN;
  state.prevDistanceM = NaN;
  state.prevSessionTime = NaN;
  // Anything acquired after a reset arms silently: the driver has just rejoined,
  // been towed, or switched reference lap, and a cue with no countdown behind it
  // is startling and carries no information.
  state.silentArm = true;
  state.progressArmDistanceM = NaN;
}

const blank = (out: BrakeCueOutput): BrakeCueOutput => {
  out.bars = 0;
  out.tone = 'off';
  out.fire = null;
  out.distanceM = NaN;
  out.progress = 0;
  return out;
};

/**
 * 0 at `armDistanceM`, 1 at the target. Unlike `levelForSeconds`, the caller
 * passes a span frozen at first display rather than one recomputed from live
 * speed every frame — see `progressArmDistanceM` — so a lift mid-approach
 * cannot shrink the denominator and collapse the bar before the target.
 */
const progressFor = (distanceM: number, armDistanceM: number): number => {
  if (!(armDistanceM > 0)) return distanceM <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, 1 - distanceM / armDistanceM));
};

/**
 * Advance the machine one tick. Mutates and returns `out` — allocation-free, so
 * it is safe to call from a rAF loop (R13.2).
 */
export function stepBrakeCueLatch(
  state: BrakeCueLatchState,
  out: BrakeCueOutput,
  tick: BrakeCueTick
): BrakeCueOutput {
  const {
    carDistanceM,
    speedMs,
    sessionTime,
    trackLengthM,
    cuePointsM,
    cuePointCount,
    referenceSpeedMs,
    audioCueLeadSec = 0,
    driving,
  } = tick;

  blank(out);

  if (
    !driving ||
    !cuePointsM ||
    cuePointCount <= 0 ||
    !(trackLengthM > 0) ||
    !Number.isFinite(carDistanceM)
  ) {
    resetBrakeCueLatch(state);
    return out;
  }

  // Seed on the first usable tick.
  if (!Number.isFinite(state.prevDistanceM)) {
    state.prevDistanceM = carDistanceM;
    state.prevSessionTime = sessionTime;
    return out;
  }

  // signedLapDelta means crossing start/finish is a small positive move, so the
  // lap wrap needs no special case anywhere below.
  const moved = signedLapDelta(state.prevDistanceM, carDistanceM, trackLengthM);
  const wentBackInTime = sessionTime < state.prevSessionTime;
  if (wentBackInTime || moved < -JUMP_BACK_M || moved > JUMP_FORWARD_M) {
    resetBrakeCueLatch(state);
    state.prevDistanceM = carDistanceM;
    state.prevSessionTime = sessionTime;
    return out;
  }

  const secondsTo = (distanceM: number) =>
    speedMs >= MIN_CUE_SPEED_MS
      ? distanceM / speedMs
      : Number.POSITIVE_INFINITY;
  const audioLeadSec = Math.max(0, Math.min(0.6, audioCueLeadSec));

  if (Number.isNaN(state.targetM)) {
    const index = nextEventIndex(
      cuePointsM,
      cuePointCount,
      carDistanceM,
      trackLengthM,
      BRAKE_CUE_LOOKAHEAD_M
    );
    if (index < 0) {
      state.prevDistanceM = carDistanceM;
      state.prevSessionTime = sessionTime;
      return out;
    }

    const candidateM = cuePointsM[index];

    // A car stopped on top of a cue point would otherwise re-acquire it every
    // frame and loop the brake tone.
    if (
      Number.isFinite(state.lastReleasedM) &&
      Math.abs(signedLapDelta(candidateM, state.lastReleasedM, trackLengthM)) <
        MIN_EVENT_SPACING_M
    ) {
      state.prevDistanceM = carDistanceM;
      state.prevSessionTime = sessionTime;
      return out;
    }

    // Pace gate, at acquisition only. Without it a formation lap, out-lap or
    // full-course yellow counts the driver down into every corner. Checked only
    // here so that slowing mid-approach — which is the whole point of braking —
    // can never cancel a countdown already under way.
    if (
      referenceSpeedMs > 0 &&
      speedMs < BRAKE_CUE_MIN_PACE_RATIO * referenceSpeedMs
    ) {
      state.prevDistanceM = carDistanceM;
      state.prevSessionTime = sessionTime;
      return out;
    }

    const seconds = secondsTo(
      signedLapDelta(carDistanceM, candidateM, trackLengthM)
    );
    const level = levelForSeconds(seconds);
    const audioLevel = levelForSeconds(seconds - audioLeadSec);
    state.targetM = candidateM;
    // A silent arm starts at whatever level the target is already at, so cues
    // for levels the driver never approached through cannot fire. -1 (further
    // off than the arm window, or no usable estimate) still arms at the top:
    // there is a full countdown ahead of them.
    state.level = state.silentArm && level >= 0 ? level : 4;
    state.audioLevel = state.silentArm && audioLevel >= 0 ? audioLevel : 4;
    state.armedAtLevel = state.level;
    // A point acquired already inside the ladder is one the driver is nearly
    // on top of — the second half of a chicane, taken while still braking for
    // the first. Cramming count2, count1 and brake into the second and a bit
    // that is left, right behind the beep for the zone before it, is noise. The
    // beep for the point itself still fires; the counts up to it do not.
    state.brakeOnly = !state.silentArm && level >= 0 && level < 4;
    state.silentArm = false;
  }

  const deltaM = signedLapDelta(carDistanceM, state.targetM, trackLengthM);

  if (deltaM > 0) {
    const want = levelForSeconds(secondsTo(deltaM));
    const audioWant = levelForSeconds(secondsTo(deltaM) - audioLeadSec);
    // The monotone rule. Nothing else may change the level while a target is
    // held: a level that wants to rise (the driver lifted) is ignored.
    if (want >= 1 && want < state.level) {
      state.level = want;
      // The bars still walk down — only the beeps are held back.
    }
    if (audioWant >= 0 && audioWant < state.audioLevel) {
      state.audioLevel = audioWant;
      if (audioWant === 0 || !state.brakeOnly) {
        out.fire = SOUND_FOR_LEVEL[audioWant];
      }
    }
    // Level 4 means "acquired but not counting yet", so it shows only once the
    // target is genuinely inside the arm window — the strip stays dark down a
    // long straight. Lower levels always show, so slowing to a crawl freezes
    // the ladder where it is instead of blanking it.
    const showing = state.level >= 1 && (state.level < 4 || want === 4);
    if (showing) {
      // Freeze the fill bar's 0% span the first frame it is shown for this
      // target, so a later speed change cannot move it — see
      // `progressArmDistanceM`.
      if (!Number.isFinite(state.progressArmDistanceM)) {
        state.progressArmDistanceM = speedMs * BRAKE_CUE_ARM_SEC;
      }
      out.bars = state.level;
      out.tone = TONE_FOR_LEVEL[state.level];
      out.distanceM = deltaM;
      out.progress = progressFor(deltaM, state.progressArmDistanceM);
    }
  } else {
    if (state.level > 0) {
      state.level = 0;
      state.holdUntilTime = sessionTime + BRAKE_CUE_HOLD_SEC;
      // A target armed inside the last second was never counted down to.
      if (state.armedAtLevel >= 2 && state.audioLevel > 0) {
        state.audioLevel = 0;
        out.fire = SOUND_FOR_LEVEL[0];
      }
    }

    const stillHolding =
      sessionTime <= state.holdUntilTime && -deltaM <= BRAKE_CUE_RELEASE_M;
    if (stillHolding) {
      out.bars = 1;
      out.tone = 'red';
      out.distanceM = 0;
      out.progress = 1;
    } else {
      state.lastReleasedM = state.targetM;
      state.targetM = NaN;
      state.level = -1;
      state.audioLevel = -1;
      state.armedAtLevel = -1;
      state.brakeOnly = false;
      state.holdUntilTime = NaN;
      state.progressArmDistanceM = NaN;
    }
  }

  state.prevDistanceM = carDistanceM;
  state.prevSessionTime = sessionTime;
  return out;
}
