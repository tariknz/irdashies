/**
 * Per-corner comparison of the lap being driven against the reference lap.
 *
 * Every lap carries per-sample lap time alongside distance, so a corner's
 * duration is simply t(end) − t(start), with each end found by linear
 * interpolation of `timeSec` on `distanceM` at the corner's exact boundary.
 * The identical operation is applied to both laps at the identical two
 * positions, so the only residual is the sub-sample interpolation error —
 * under 5 ms at telemetry rate — and it is the same order on both sides.
 *
 * Where the time comes from differs by source and is worth knowing:
 *  - live lap, own best, .ibt: SessionTime from the sim, exact;
 *  - Garage 61 CSV: no time column, so it is integrated from speed at import
 *    and normalised to the lap time in the filename. Accurate to the extent
 *    the speed trace is, which at 60 Hz is very.
 *
 * Two tempting "improvements" that are wrong, recorded so they aren't made:
 *
 *  1. "Snap the range to the brake/throttle event markers." Those sit at
 *     different places on the two laps by construction, so the compared stretch
 *     of road would differ between them. The range must come from the corner
 *     geometry alone.
 *  2. "Fill a gap in the driver's lap by interpolating across it." A lap that
 *     skipped part of the corner (tow, reset, dropped frames) has no time for
 *     that stretch; inventing one would manufacture a delta. Blank instead.
 */

import {
  minOver,
  normalisePct,
  samplesCover,
  timeAtDistance,
} from './lapSamples';
import type { LapTraceSamples } from '@irdashies/types';

/**
 * Below this a lap is not "driving" through the corner: a spin, a stop, or a
 * standing start. The time would be arithmetically true but meaningless.
 */
export const MIN_VALID_SPEED_MS = 1;

/** A "corner" shorter than this is data noise, not a corner. */
export const MIN_CORNER_LENGTH_M = 10;

/** No real corner spans this much of a lap; a range this wide means bad data. */
export const MAX_CORNER_LAP_FRACTION = 0.5;

/**
 * Past this the driver went off, spun, or was let by. The number is
 * arithmetically true but tells them nothing, so the panel blanks instead.
 */
export const MAX_PLAUSIBLE_CORNER_DELTA_SEC = 10;

export interface CornerRange {
  startM: number;
  endM: number;
}

export interface CornerLapMetrics {
  /** t(endM) − t(startM). */
  timeSec: number;
  /** Lowest speed in the range — the apex. */
  minSpeedMs: number;
}

export interface CornerComparison {
  /** driverTimeSec - referenceTimeSec. Negative means the driver was faster. */
  timeDeltaSec: number;
  /** driverMinSpeedMs - referenceMinSpeedMs. Positive means more speed carried. */
  apexSpeedDeltaMs: number;
  driverTimeSec: number;
  referenceTimeSec: number;
  driverMinSpeedMs: number;
  referenceMinSpeedMs: number;
}

/**
 * Metres covered by a corner, from its start/end lap percentages.
 *
 * A corner straddling the start/finish line comes back null: the live lap is
 * reset at the line, so it can never hold both halves, and there is nothing
 * to compare a reference half against.
 */
export function cornerRange(
  startPct: number,
  endPct: number,
  trackLengthM: number
): CornerRange | null {
  if (!(trackLengthM > 0)) return null;
  if (!Number.isFinite(startPct) || !Number.isFinite(endPct)) return null;

  const startM = normalisePct(startPct) * trackLengthM;
  const endM = normalisePct(endPct) * trackLengthM;
  if (endM <= startM) return null;

  const lengthM = endM - startM;
  if (lengthM < MIN_CORNER_LENGTH_M) return null;
  if (lengthM > trackLengthM * MAX_CORNER_LAP_FRACTION) return null;

  return { startM, endM };
}

/**
 * Corner duration and apex speed for one lap.
 *
 * Deliberately all-or-nothing: a lap that did not drive the whole corner, or
 * one that crawled through it, invalidates the corner rather than producing a
 * number that looks like a comparison and isn't.
 */
export function cornerLapMetrics(
  samples: LapTraceSamples,
  startM: number,
  endM: number
): CornerLapMetrics | null {
  if (!samplesCover(samples, startM, endM)) return null;

  const timeSec =
    timeAtDistance(samples, endM) - timeAtDistance(samples, startM);
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;

  const minSpeedMs = minOver(samples, samples.speed, startM, endM);
  // Negated comparison so NaN fails closed rather than slipping through.
  if (!(minSpeedMs > MIN_VALID_SPEED_MS)) return null;

  return { timeSec, minSpeedMs };
}

/**
 * Compare one corner between the lap being driven and the reference lap.
 *
 * Returns null whenever the comparison would be untrustworthy rather than
 * guessing: an unusable range, a lap that did not fully drive the corner, or a
 * delta so large it must be an off rather than a driving mistake.
 */
export function compareCorner({
  startPct,
  endPct,
  trackLengthM,
  driverSamples,
  referenceSamples,
}: {
  startPct: number;
  endPct: number;
  trackLengthM: number;
  driverSamples: LapTraceSamples;
  referenceSamples: LapTraceSamples;
}): CornerComparison | null {
  const range = cornerRange(startPct, endPct, trackLengthM);
  if (!range) return null;

  const driver = cornerLapMetrics(driverSamples, range.startM, range.endM);
  if (!driver) return null;

  const reference = cornerLapMetrics(
    referenceSamples,
    range.startM,
    range.endM
  );
  if (!reference) return null;

  const timeDeltaSec = driver.timeSec - reference.timeSec;
  if (Math.abs(timeDeltaSec) > MAX_PLAUSIBLE_CORNER_DELTA_SEC) return null;

  return {
    timeDeltaSec,
    apexSpeedDeltaMs: driver.minSpeedMs - reference.minSpeedMs,
    driverTimeSec: driver.timeSec,
    referenceTimeSec: reference.timeSec,
    driverMinSpeedMs: driver.minSpeedMs,
    referenceMinSpeedMs: reference.minSpeedMs,
  };
}
