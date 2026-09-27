/**
 * The two fades the radar has, both kept pure so the ramp maths is testable
 * without a canvas or a clock.
 */

/** Where a fade is heading: 1 fully on screen, 0 fully off. */
export type FadeTarget = 0 | 1;

/**
 * Keep an edge car visible because a car the driver cannot see is worse than
 * one that pops in.
 */
const CAR_FADE_FLOOR = 0.15;

/** Leave room inside the range so the near-range gate always has a visible car. */
export const MAX_RADAR_RANGE_M = 500;

export const RADAR_SHOW_RANGE_MARGIN_M = 0.5;

export const advanceFade = (
  current: number,
  target: FadeTarget,
  dtSeconds: number,
  fadeSeconds: number
): number => {
  if (fadeSeconds <= 0) return target;
  const step = Math.max(0, dtSeconds) / fadeSeconds;
  if (current < target) return Math.min(target, current + step);
  if (current > target) return Math.max(target, current - step);
  return current;
};

/**
 * How opaque a car at `distanceM` from the player should be, given a fade band
 * at the outer edge of the range.
 *
 * A car is solid once it is inside the band and ramps toward the edge without
 * disappearing, so cars enter and leave the view gradually while remaining
 * visible. `fadeBandM` of 0 means no band and every car is solid.
 */
export const carFadeAt = (
  distanceM: number,
  radarRange: number,
  fadeBandM: number
): number => {
  if (fadeBandM <= 0) return 1;
  if (!Number.isFinite(distanceM)) return 0;
  const band = Math.min(fadeBandM, radarRange);
  const opacity = (radarRange - distanceM) / band;
  const fadedOpacity = opacity * (1 - CAR_FADE_FLOOR) + CAR_FADE_FLOOR;
  return Math.min(1, Math.max(CAR_FADE_FLOOR, fadedOpacity));
};
