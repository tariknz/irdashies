import {
  normalizeKey,
  REFERENCE_INTERVAL,
  ReferenceLap,
} from '@irdashies/context';

/**
 * O(1) Interpolation using direct Map lookups.
 */
export function interpolateAtPoint(
  lap: ReferenceLap,
  targetPct: number
): number | null {
  // 1. Normalize the target to find the exact grid key (p0)
  const key0 = normalizeKey(targetPct);

  // 2. Calculate the next key (p1)
  // We manually add the interval and re-normalize to handle floating point math
  const key1 = normalizeKey(targetPct + REFERENCE_INTERVAL);

  // 3. Fast Lookup
  const p0 = lap.refPoints.get(key0);
  const p1 = lap.refPoints.get(key1);

  // Handle Edge Case: Wrapping or End of Lap
  // If we are at the very end (e.g., 0.9975 -> 0.0000), p1 might be the start point.
  // We cannot interpolate PCHIP across the finish line without extra logic for the X-axis wrap.
  // For now, if p1 is missing or wrapped inappropriately, we fall back to p0 (clamping).
  if (!p0) {
    console.log('P1 is missing!');
    return null; // Off-track or sparse map gap
  }

  if (!p1) {
    console.log('P2 is missing!');
    return p0.timeElapsedSinceStart; // End of data, return last known time
  }

  // 4. Validate Tangents
  if (p0.tangent === undefined || p1.tangent === undefined) {
    // Fallback if PCHIP wasn't run: simple linear interpolation could go here,
    // but better to warn.
    console.warn('Missing tangents for PCHIP interpolation');
    return null;
  }

  // 5. Hermite Interpolation
  // Note: We use the actual p1.trackPct - p0.trackPct for h,
  // because the map keys might be normalized but the stored pct is precise.
  let h = p1.trackPct - p0.trackPct;
  let y1 = p1.timeElapsedSinceStart;

  // Guard against divide by zero or wrapped points (e.g. 0.99 - 0.00)
  if (h <= 0) {
    // We're wrapping around the finish line
    h = 1 - p0.trackPct + p1.trackPct; // Distance wrapping through 0
    const lapTime = lap.finishTime - lap.startTime;
    y1 = p1.timeElapsedSinceStart + lapTime; // Add lap time to next point
  }

  const t = (targetPct - p0.trackPct) / h;

  return hermiteBasis(
    t,
    p0.timeElapsedSinceStart,
    y1,
    p0.tangent * h,
    p1.tangent * h
  );
}

function hermiteBasis(
  t: number,
  y0: number,
  y1: number,
  m0: number,
  m1: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1;
}
