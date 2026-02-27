import { ReferenceLap } from '@irdashies/types';
import {
  normalizeKey,
  REFERENCE_INTERVAL,
} from '../../context/ReferenceLapStore/ReferenceLapStore';

/**
 * Pre-computes and stores Fritsch-Carlson PCHIP tangents for each point in the lap.
 * Mutates the ReferencePoint objects inside the lap.refPoints Map.
 */
export function precomputePCHIPTangents(lap: ReferenceLap): void {
  // 1. Extract and sort to ensure monotonic X order for the algorithm
  const sorted = Array.from(lap.refPoints.values()).sort(
    (a, b) => a.trackPct - b.trackPct
  );

  if (sorted.length < 2) return;

  const x = sorted.map((p) => p.trackPct);
  const y = sorted.map((p) => p.timeElapsedSinceStart);

  const lapTime = lap.finishTime - lap.startTime;
  // 2. Compute tangents
  const tangents = computePCHIPTangents(x, y, lapTime);

  // 3. Assign back to the objects.
  // Since 'sorted' contains references to the objects in the Map,
  // this mutation directly updates the Map values.
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].tangent = tangents[i];
  }
}

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

// ---------------------------------------------------------------------------
// PCHIP Tangents Calculation
// ---------------------------------------------------------------------------

function computePCHIPTangents(
  x: number[],
  y: number[],
  lapTime: number
): number[] {
  const n = x.length;
  const tangents = new Array<number>(n);
  const deltas = new Array<number>(n - 1);

  // Calculate deltas for interior points
  for (let k = 0; k < n - 1; k++) {
    deltas[k] = (y[k + 1] - y[k]) / (x[k + 1] - x[k]);
  }

  // For the first point (x[0]), we need to look back to the last point
  // The "previous" point wraps around: it's at position (x[n-1] - 1) with time (y[n-1] - lapTime)
  const delta_before_first =
    (y[0] - (y[n - 1] - lapTime)) / (x[0] - (x[n - 1] - 1));

  // For the last point (x[n-1]), we need to look forward to the first point
  // The "next" point wraps around: it's at position (x[0] + 1) with time (y[0] + lapTime)
  const delta_after_last = (y[0] + lapTime - y[n - 1]) / (x[0] + 1 - x[n - 1]);

  // Calculate tangent for first point
  const d_0 = delta_before_first;
  const d_1 = deltas[0];
  if (d_0 * d_1 <= 0) {
    tangents[0] = 0;
  } else {
    const dx_after = x[1] - x[0];
    const dx_before = x[0] - (x[n - 1] - 1);
    const w1 = 2 * dx_after + dx_before;
    const w2 = dx_after + 2 * dx_before;
    tangents[0] = (w1 + w2) / (w1 / d_0 + w2 / d_1);
  }

  // Calculate tangent for last point
  const d_nm2 = deltas[n - 2];
  const d_nm1 = delta_after_last;
  if (d_nm2 * d_nm1 <= 0) {
    tangents[n - 1] = 0;
  } else {
    const dx_before = x[n - 1] - x[n - 2];
    const dx_after = x[0] + 1 - x[n - 1];
    const w1 = 2 * dx_after + dx_before;
    const w2 = dx_after + 2 * dx_before;
    tangents[n - 1] = (w1 + w2) / (w1 / d_nm2 + w2 / d_nm1);
  }

  // Interior points remain the same
  for (let k = 1; k < n - 1; k++) {
    const d_k = deltas[k - 1];
    const d_kp1 = deltas[k];
    if (d_k * d_kp1 <= 0) {
      tangents[k] = 0;
    } else {
      const w1 = 2 * (x[k + 1] - x[k]) + (x[k] - x[k - 1]);
      const w2 = x[k + 1] - x[k] + 2 * (x[k] - x[k - 1]);
      tangents[k] = (w1 + w2) / (w1 / d_k + w2 / d_kp1);
    }
  }

  return tangents;
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
