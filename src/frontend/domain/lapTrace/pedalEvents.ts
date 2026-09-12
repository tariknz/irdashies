import type { LapTraceEvents, LapTraceSamples } from '@irdashies/types';

/**
 * Sub-metre pedal application points.
 *
 * Telemetry arrives at a fixed rate, so at speed consecutive samples are a
 * metre or more apart. The *crossing* is recoverable though: with the pedal
 * position and the lap distance on both sides of the threshold, the point at
 * which the pedal actually came on solves by linear interpolation. That is the
 * number the driver reads — "I braked three metres late" — so it is kept at
 * full precision.
 *
 * One tracker serves every lap. The live recorder feeds it sample by sample,
 * and deriveEvents() runs the same tracker over a stored lap on hydrate, so a
 * stored lap and the lap it was recorded from produce identical events, and a
 * threshold change applies to every lap ever saved.
 *
 */

/** Pedal is considered applied above this. */
export const PEDAL_ON_THRESHOLD = 0.01;
/**
 * ...and released below this. Held equal to the on-threshold — the on/off pair
 * sits low enough that the only thing between them is float dust, so there is
 * no hysteresis band to speak of. Chatter is handled downstream by
 * MIN_EVENT_SPACING_M instead.
 *
 * The brake carries a second release level on top of this one; see
 * BRAKE_RELEASE_FRACTION.
 */
export const PEDAL_OFF_THRESHOLD = 0.01;

/**
 * A brake application also ends when the pedal falls to this fraction of the
 * hardest it reached during that application — even though it is still pressed.
 *
 * The two braking zones of a chicane are usually joined by a trail-brake that
 * never lets go. Through Imola's Variante Villeneuve the pedal runs 55% → 3% →
 * 39%: two unmistakable zones, and at no point below the 1% release. Judged on
 * 1% alone that is a single 160 m application, so the second half of the
 * chicane has no brake point of its own — nothing to mark, nothing to count
 * down to, and nothing for the Last Corner panel to compare. Judged against the
 * zone's own peak it reads as what it looks like: a release and a fresh
 * application.
 *
 * A fraction of the peak rather than an absolute pedal position, so it carries
 * across cars and brake biases and judges a light zone as leniently as a heavy
 * one. Whether either zone is worth cueing is a separate question, answered by
 * the speed it scrubs — see brakeCuePoints.ts.
 */
export const BRAKE_RELEASE_FRACTION = 0.1;

/** Per-lap cap on each event list (R3.2/R6.3). ~20 corners yields ~20 each. */
export const MAX_LAP_EVENTS = 128;

/**
 * Two events of the same kind closer than this are treated as chatter and the
 * second is dropped. With the on/off thresholds equal this is the sole chatter
 * guard, and it covers noise without swallowing a genuine lift-and-reapply
 * through a chicane.
 */
export const MIN_EVENT_SPACING_M = 5;

/**
 * Distance at which a signal crossed `threshold` between two samples. Samples
 * are in lap metres and never straddle the line (a lap is reset at the line),
 * so no wrap handling is needed.
 */
export function interpolateCrossingM(
  threshold: number,
  prevM: number,
  prevValue: number,
  currM: number,
  currValue: number
): number {
  const denom = currValue - prevValue;

  // A flat pair carries no crossing information — attribute it to the sample
  // that satisfied the threshold rather than inventing a position.
  const t =
    denom === 0 ? 1 : Math.max(0, Math.min(1, (threshold - prevValue) / denom));

  return prevM + t * (currM - prevM);
}

/**
 * Append an event position, honouring the cap and the chatter guard.
 * Returns the new count. Mutates in place — no allocation (R13.2).
 */
export function recordEvent(
  positions: Float32Array,
  count: number,
  metres: number
): number {
  if (count >= MAX_LAP_EVENTS) return count;
  if (
    count > 0 &&
    Math.abs(metres - positions[count - 1]) < MIN_EVENT_SPACING_M
  ) {
    return count;
  }
  positions[count] = metres;
  return count + 1;
}

/**
 * Schmitt-trigger state for one lap's pedal events. Fixed-size buffers, reset
 * in place per lap; the live lap keeps one and reads the counts directly.
 */
export interface PedalEventTracker {
  brakeOnM: Float32Array;
  brakeOffM: Float32Array;
  throttleOnM: Float32Array;
  brakeOnCount: number;
  brakeOffCount: number;
  throttleOnCount: number;
  brakeIsOn: boolean;
  /** Hardest the pedal has been during the brake application in progress. */
  brakePeak: number;
  /**
   * Pedal level a new brake application has to exceed. PEDAL_ON_THRESHOLD
   * normally; after a release that left the pedal still pressed it holds that
   * release level until the pedal genuinely comes off, so the next sample
   * cannot re-arm on the very pressure that just counted as a release.
   */
  brakeArmLevel: number;
  throttleIsOn: boolean;
  prevBrake: number;
  prevThrottle: number;
  prevM: number;
  /** False until the first sample has seeded the on/off state. */
  started: boolean;
}

export function createPedalEventTracker(): PedalEventTracker {
  return {
    brakeOnM: new Float32Array(MAX_LAP_EVENTS),
    brakeOffM: new Float32Array(MAX_LAP_EVENTS),
    throttleOnM: new Float32Array(MAX_LAP_EVENTS),
    brakeOnCount: 0,
    brakeOffCount: 0,
    throttleOnCount: 0,
    brakeIsOn: false,
    brakePeak: 0,
    brakeArmLevel: PEDAL_ON_THRESHOLD,
    throttleIsOn: false,
    prevBrake: 0,
    prevThrottle: 0,
    prevM: 0,
    started: false,
  };
}

export function resetPedalEventTracker(tracker: PedalEventTracker): void {
  tracker.brakeOnCount = 0;
  tracker.brakeOffCount = 0;
  tracker.throttleOnCount = 0;
  tracker.brakeIsOn = false;
  tracker.brakePeak = 0;
  tracker.brakeArmLevel = PEDAL_ON_THRESHOLD;
  tracker.throttleIsOn = false;
  tracker.prevBrake = 0;
  tracker.prevThrottle = 0;
  tracker.prevM = 0;
  tracker.started = false;
}

/**
 * Feed one sample. The first sample only seeds the on/off state: a lap that
 * starts under braking or on the throttle (every lap does the latter) must
 * not report a phantom application at the line.
 */
export function pedalEventTrackerPush(
  tracker: PedalEventTracker,
  distanceM: number,
  throttle: number,
  brake: number
): void {
  if (!tracker.started) {
    tracker.brakeIsOn = brake >= PEDAL_ON_THRESHOLD;
    tracker.brakePeak = brake;
    tracker.brakeArmLevel = PEDAL_ON_THRESHOLD;
    tracker.throttleIsOn = throttle >= PEDAL_ON_THRESHOLD;
    tracker.prevBrake = brake;
    tracker.prevThrottle = throttle;
    tracker.prevM = distanceM;
    tracker.started = true;
    return;
  }

  const prevM = tracker.prevM;

  if (!tracker.brakeIsOn) {
    // A raised arm level lasts only until the pedal genuinely comes off.
    if (brake <= PEDAL_ON_THRESHOLD) tracker.brakeArmLevel = PEDAL_ON_THRESHOLD;
    // Strictly above a raised level: the release fired at or below it, so `>=`
    // would re-apply on the very next sample at the same pressure.
    const applied =
      tracker.brakeArmLevel > PEDAL_ON_THRESHOLD
        ? brake > tracker.brakeArmLevel
        : brake >= PEDAL_ON_THRESHOLD;
    if (applied) {
      tracker.brakeOnCount = recordEvent(
        tracker.brakeOnM,
        tracker.brakeOnCount,
        interpolateCrossingM(
          tracker.brakeArmLevel,
          prevM,
          tracker.prevBrake,
          distanceM,
          brake
        )
      );
      tracker.brakeIsOn = true;
      tracker.brakePeak = brake;
    }
  } else {
    if (brake > tracker.brakePeak) tracker.brakePeak = brake;
    // Whichever comes first: off the pedal, or down to a tenth of this
    // application's peak. See BRAKE_RELEASE_FRACTION.
    const releaseLevel = Math.max(
      PEDAL_OFF_THRESHOLD,
      tracker.brakePeak * BRAKE_RELEASE_FRACTION
    );
    if (brake <= releaseLevel) {
      tracker.brakeOffCount = recordEvent(
        tracker.brakeOffM,
        tracker.brakeOffCount,
        interpolateCrossingM(
          releaseLevel,
          prevM,
          tracker.prevBrake,
          distanceM,
          brake
        )
      );
      tracker.brakeIsOn = false;
      // The raised level exists only to stop a still-pressed pedal re-arming
      // on the pressure that just counted as a release. A pedal already off
      // needs no guard, and must re-arm at the ordinary threshold.
      tracker.brakeArmLevel =
        brake <= PEDAL_ON_THRESHOLD ? PEDAL_ON_THRESHOLD : releaseLevel;
    }
  }

  if (!tracker.throttleIsOn && throttle >= PEDAL_ON_THRESHOLD) {
    tracker.throttleOnCount = recordEvent(
      tracker.throttleOnM,
      tracker.throttleOnCount,
      interpolateCrossingM(
        PEDAL_ON_THRESHOLD,
        prevM,
        tracker.prevThrottle,
        distanceM,
        throttle
      )
    );
    tracker.throttleIsOn = true;
  } else if (tracker.throttleIsOn && throttle <= PEDAL_OFF_THRESHOLD) {
    tracker.throttleIsOn = false;
  }

  tracker.prevBrake = brake;
  tracker.prevThrottle = throttle;
  tracker.prevM = distanceM;
}

/** Exact-length copies of the event lists recorded so far. */
export function pedalEventTrackerSnapshot(
  tracker: PedalEventTracker
): LapTraceEvents {
  return {
    brakeOnM: tracker.brakeOnM.slice(0, tracker.brakeOnCount),
    brakeOffM: tracker.brakeOffM.slice(0, tracker.brakeOffCount),
    throttleOnM: tracker.throttleOnM.slice(0, tracker.throttleOnCount),
  };
}

/**
 * Events for a complete lap, by running the tracker over its samples — byte
 * for byte what the live recorder would have produced from the same stream.
 */
export function deriveEvents(samples: LapTraceSamples): LapTraceEvents {
  const tracker = createPedalEventTracker();
  const { distanceM, throttle, brake } = samples;
  for (let i = 0; i < samples.length; i++) {
    pedalEventTrackerPush(tracker, distanceM[i], throttle[i], brake[i]);
  }
  return pedalEventTrackerSnapshot(tracker);
}

/**
 * Signed distance from `fromM` to `toM` around a closed lap, in (-L/2, L/2].
 * Positive means `toM` is ahead. Used to pair a live application point with the
 * reference one it should be compared against.
 */
export function signedLapDelta(
  fromM: number,
  toM: number,
  trackLengthM: number
): number {
  if (!(trackLengthM > 0)) return toM - fromM;
  let delta = (toM - fromM) % trackLengthM;
  if (delta > trackLengthM / 2) delta -= trackLengthM;
  if (delta < -trackLengthM / 2) delta += trackLengthM;
  return delta;
}

/**
 * Nearest event to `targetM`, or -1 if none is within `maxDistanceM`.
 * `count` bounds the search so a partially filled buffer can be passed directly.
 */
export function nearestEventIndex(
  positions: Float32Array,
  count: number,
  targetM: number,
  trackLengthM: number,
  maxDistanceM: number
): number {
  let best = -1;
  let bestAbs = maxDistanceM;
  for (let i = 0; i < count; i++) {
    const abs = Math.abs(signedLapDelta(targetM, positions[i], trackLengthM));
    if (abs <= bestAbs) {
      bestAbs = abs;
      best = i;
    }
  }
  return best;
}

/**
 * Nearest event strictly ahead of `fromM`, or -1 if none is within
 * `maxDistanceM`. Used to find the point that closes out whatever `fromM`
 * opened — e.g. the throttle application that ends the corner a given brake
 * point started.
 */
export function nextEventIndex(
  positions: Float32Array,
  count: number,
  fromM: number,
  trackLengthM: number,
  maxDistanceM: number
): number {
  let best = -1;
  let bestDelta = maxDistanceM;
  for (let i = 0; i < count; i++) {
    const delta = signedLapDelta(fromM, positions[i], trackLengthM);
    if (delta > 0 && delta <= bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}
