/**
 * The panel fade, kept pure so the ramp maths is testable without a canvas or
 * a clock.
 */

/** Where a fade is heading: 1 fully on screen, 0 fully off. */
type FadeTarget = 0 | 1;

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
