import { getBucketIndex } from '@irdashies/context';
import type { ReferenceLap } from '@irdashies/types';

/**
 * "Is this lap usable as a speed reference", cached by lap identity.
 *
 * A promoted lap's speedsKph never changes, so this scan runs once per
 * reference lap rather than once per frame.
 */
const usableCache = new WeakMap<ReferenceLap, boolean>();

/**
 * True when every bucket of the lap carries a recorded speed.
 *
 * Speed recording only starts once the player's car index is known, so a lap
 * already in progress at that moment is still a valid *time* reference (and can
 * still be promoted to session best) while missing speeds for its early
 * buckets. We reject such a lap outright rather than blanking the bar across
 * part of every lap for the rest of the session, which would read as a broken
 * widget instead of a deliberate empty state.
 */
export function hasCompleteSpeedTrace(lap: ReferenceLap): boolean {
  const cached = usableCache.get(lap);
  if (cached !== undefined) return cached;

  const speeds = lap.speedsKph;
  // Length must match the lap's bucket count, not merely be non-empty: a
  // shorter trace reads as complete here while interpolation returns null for
  // every bucket past its end, which is the blanking this guard exists to
  // prevent. The recorder always allocates pointsCount, so this is an
  // invariant check rather than a known failure.
  let usable = !!speeds && speeds.length === lap.pointsCount;

  if (speeds && usable) {
    for (const speed of speeds) {
      if (speed <= 0) {
        usable = false;
        break;
      }
    }
  }

  usableCache.set(lap, usable);
  return usable;
}

/**
 * Reference speed (km/h) at a point on the lap, linearly interpolated between
 * the two nearest recorded buckets.
 *
 * Linear rather than PCHIP: speed is not monotonic along a lap, so the
 * monotone-cubic tangents used for the time curve don't apply.
 *
 * @returns null when either bounding bucket has no usable data.
 */
export function interpolateSpeedAtPoint(
  lap: ReferenceLap,
  targetPct: number
): number | null {
  const speeds = lap.speedsKph;
  if (!speeds) return null;

  const key0 = getBucketIndex(targetPct, lap.pointsCount);
  // Explicit modular step rather than getBucketIndex(targetPct + interval):
  // that helper *clamps* to pointsCount - 1, so in the final bucket it would
  // collapse key1 onto key0 and hold the last recorded speed flat all the way
  // to the line. The bucket after the last one is bucket 0.
  const key1 = key0 + 1 >= lap.pointsCount ? 0 : key0 + 1;

  const p0 = lap.pointPos[key0];
  const p1 = lap.pointPos[key1];
  const v0 = speeds[key0];
  const v1 = speeds[key1];

  if (p0 === undefined || p1 === undefined || p0 < 0 || p1 < 0) return null;
  // 0 is the "never recorded" sentinel, not a literal 0 km/h.
  if (v0 === undefined || v1 === undefined || v0 <= 0 || v1 <= 0) return null;

  let h = p1 - p0;
  if (h <= 0) {
    // Wrapping through the start/finish line. Unlike the time curve there is no
    // lap-time term to add here — speed is instantaneous, not cumulative.
    h = 1 - p0 + p1;
  }
  if (h <= 0) return v0;

  // Clamped because pointPos holds the precise position at bucket entry, which
  // can sit slightly ahead of targetPct and push t marginally out of range.
  const t = Math.min(Math.max((targetPct - p0) / h, 0), 1);

  return v0 + (v1 - v0) * t;
}
