/**
 * Sliding-window geometry for the lap trace plot.
 *
 * The car sits at a fixed x position along a window of track distance that
 * need not be split evenly — a driver wants more track ahead than behind, so
 * the window is defined as separate ahead/behind distances rather than one
 * width. Symmetric ahead/behind puts the car at the midpoint; an asymmetric
 * split shifts it. The past is to the left, the upcoming track to the right.
 *
 * The subtle part is the start/finish seam. Distances are *unwrapped* — the
 * window may reach below 0 or past the lap length — and a range is cut into
 * one piece per lap it touches (lapPieces in lapTraceTiles), each mapping
 * back to a lap-local range plus the offset that unwrapped it, so x keeps
 * increasing while the data lookup wraps. Approaching the line, the right
 * half of the plot correctly shows the beginning of the reference lap, and
 * the path never snaps back on itself.
 */

/** Plot viewBox width in user units. */
export const VIEW_WIDTH = 1000;

/**
 * The largest "Distance Behind" the settings offer, and so the furthest the
 * plot can ever look back. The recorder keeps this much of each finished lap
 * so the driver's own trace can run through the start/finish line at any
 * window size; the settings slider takes its maximum from here.
 */
export const MAX_METERS_BEHIND = 600;

/**
 * Map an absolute track distance to an x coordinate in the plot's viewBox.
 * `carDistanceM` maps to `carXForWindow(metersBehind, metersAhead)`.
 */
export function xForMetres(
  distanceM: number,
  carDistanceM: number,
  metersBehind: number,
  metersAhead: number,
  viewWidth: number = VIEW_WIDTH
): number {
  const total = metersBehind + metersAhead;
  if (!(total > 0)) return viewWidth / 2;
  return ((distanceM - carDistanceM + metersBehind) / total) * viewWidth;
}

/**
 * Where the car marker sits on the x-axis for a given ahead/behind split.
 * Symmetric ahead/behind puts it at `viewWidth / 2`; more distance on one
 * side shifts it away from that side.
 */
export function carXForWindow(
  metersBehind: number,
  metersAhead: number,
  viewWidth: number = VIEW_WIDTH
): number {
  const total = metersBehind + metersAhead;
  if (!(total > 0)) return viewWidth / 2;
  return (metersBehind / total) * viewWidth;
}
