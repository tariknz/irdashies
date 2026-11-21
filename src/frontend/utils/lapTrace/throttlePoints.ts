/**
 * Which of a lap's throttle applications are worth marking.
 *
 * `LapTraceEvents.throttleOnM` records EVERY upward crossing of the pedal
 * threshold, and a gear change produces two that are not throttle points at
 * all: a downshift blip puts a brief spike in the middle of a braking zone,
 * and an upshift lift puts a brief gap in the middle of a straight whose
 * re-application reads as a fresh application. Marking either says the driver
 * picked the throttle up there, which is the one thing the marker means.
 *
 * The tracker cannot tell at the crossing — the shift has not happened yet
 * when a blip starts. It is obvious over the finished lap though, and the
 * markers only ever draw a hydrated reference lap, so this filters the raw
 * array once on hydrate.
 *
 * Both artefacts reduce to one shape: a *short* interruption with the gear
 * changing across it. That is what keeps a corner exit safe without any
 * tolerance to tune — the braking zone before it is a long throttle-off span
 * and the throttle stays on for hundreds of metres after it, so a downshift
 * landing right before the pickup cannot suppress it.
 */

import type { LapTraceSamples } from '@irdashies/types';
import { indexAtOrBefore } from './lapSamples';
import { PEDAL_OFF_THRESHOLD, PEDAL_ON_THRESHOLD } from './pedalEvents';

/**
 * A throttle interruption longer than this is driving, not a shift. A blip is
 * a couple of tenths and an upshift lift less; a chicane lift or a corner's
 * braking zone is far longer.
 */
export const SHIFT_SPAN_MAX_SEC = 0.5;

const EMPTY = new Float32Array(0);

/**
 * The gear in effect at sample `i`, searching in `step` direction for the
 * first non-neutral one. Neutral is what the sim reports for the instant
 * between two gears, so reading it would make every shift look like two.
 * Returns 0 when the lap carries no gear data in that direction.
 */
function gearAt(
  gear: Float32Array,
  i: number,
  step: 1 | -1,
  length: number
): number {
  for (let j = i; j >= 0 && j < length; j += step) {
    const g = Math.round(gear[j]);
    if (g !== 0) return g;
  }
  return 0;
}

/** Did the gear change between samples `from` and `to`, ignoring neutral? */
function shiftedBetween(
  gear: Float32Array,
  from: number,
  to: number,
  length: number
): boolean {
  const before = gearAt(gear, from, -1, length);
  const after = gearAt(gear, to, 1, length);
  // 0 means the lap has no gear data on that side; without it there is nothing
  // to compare, so nothing is treated as a shift.
  return before !== 0 && after !== 0 && before !== after;
}

/**
 * Index the throttle is released at, walking forward from `from`, or -1 when
 * it stays on past `SHIFT_SPAN_MAX_SEC` (or to the end of the lap).
 */
function releaseIndex(samples: LapTraceSamples, from: number): number {
  const { throttle, timeSec } = samples;
  const deadline = timeSec[from] + SHIFT_SPAN_MAX_SEC;
  for (let i = from; i < samples.length; i++) {
    if (timeSec[i] > deadline) return -1;
    if (throttle[i] <= PEDAL_OFF_THRESHOLD) return i;
  }
  return -1;
}

/**
 * Index the throttle was last on at, walking back from `from`, or -1 when it
 * has been off for longer than `SHIFT_SPAN_MAX_SEC` (or since the lap began).
 */
function previousOnIndex(samples: LapTraceSamples, from: number): number {
  const { throttle, timeSec } = samples;
  const deadline = timeSec[from] - SHIFT_SPAN_MAX_SEC;
  for (let i = from; i >= 0; i--) {
    if (timeSec[i] < deadline) return -1;
    if (throttle[i] >= PEDAL_ON_THRESHOLD) return i;
  }
  return -1;
}

/**
 * `throttleOnM` with the gear-change artefacts removed. Ascending, and a
 * subset of the input — the positions themselves are untouched.
 */
export function selectThrottlePoints(
  samples: LapTraceSamples,
  throttleOnM: Float32Array
): Float32Array {
  const n = samples.length;
  // Nothing to judge them against, so keep them: a missing marker is worse
  // than an artefact.
  if (n < 2) return throttleOnM;
  if (throttleOnM.length === 0) return EMPTY;

  const { gear } = samples;
  const kept = new Float32Array(throttleOnM.length);
  let keptCount = 0;

  for (const pointM of throttleOnM) {
    // The crossing was interpolated between the sample below the threshold and
    // the one at or above it, so the application starts at the sample after.
    const before = indexAtOrBefore(samples, pointM);
    const onFrom = Math.min(Math.max(before + 1, 0), n - 1);

    // A blip: released again almost at once, with the gear changing over it.
    const released = releaseIndex(samples, onFrom);
    if (released >= 0 && shiftedBetween(gear, onFrom, released, n)) continue;

    // An upshift lift: the throttle was on again only a moment before this,
    // with the gear changing over the gap.
    const lastOn = before >= 0 ? previousOnIndex(samples, before) : -1;
    if (lastOn >= 0 && shiftedBetween(gear, lastOn, onFrom, n)) continue;

    kept[keptCount++] = pointM;
  }

  return keptCount === throttleOnM.length ? kept : kept.slice(0, keptCount);
}
