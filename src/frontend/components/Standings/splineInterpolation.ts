import {
  ReferenceLap,
  normalizeKey,
  REFERENCE_INTERVAL,
} from './hooks/useReferenceRegistry';

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

  // 2. Compute tangents
  const tangents = computePCHIPTangents(x, y);

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
  const h = p1.trackPct - p0.trackPct;

  // Guard against divide by zero or wrapped points (e.g. 0.99 - 0.00)
  if (h <= 0) return p0.timeElapsedSinceStart;

  const t = (targetPct - p0.trackPct) / h;

  return hermiteBasis(
    t,
    p0.timeElapsedSinceStart,
    p1.timeElapsedSinceStart,
    p0.tangent * h,
    p1.tangent * h
  );
}

// ---------------------------------------------------------------------------
// PCHIP Tangents Calculation
// ---------------------------------------------------------------------------

function computePCHIPTangents(x: number[], y: number[]): number[] {
  const n = x.length;
  const tangents = new Array<number>(n);
  const deltas = new Array<number>(n - 1);

  for (let k = 0; k < n - 1; k++) {
    deltas[k] = (y[k + 1] - y[k]) / (x[k + 1] - x[k]);
  }

  tangents[0] = deltas[0];
  tangents[n - 1] = deltas[n - 2];

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
