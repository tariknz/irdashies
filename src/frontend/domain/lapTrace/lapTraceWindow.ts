/**
 * Sliding-window geometry for the lap trace plot.
 *
 * The car sits at a fixed x position along a window of track distance that
 * need not be split evenly — a driver wants more track ahead than behind, so
 * the window is defined as separate ahead/behind distances rather than one
 * width. Symmetric ahead/behind puts the car at the midpoint; an asymmetric
 * split shifts it. The past is to the left, the upcoming track to the right.
 *
 * The subtle part is the start/finish seam. The window is expressed in
 * *unwrapped* metres — it may reach below 0 or past the lap length — and is
 * cut into pieces, one per lap the window touches. Each piece maps back to a
 * lap-local range plus the offset that unwrapped it, so x keeps increasing
 * across the whole window while the data lookup wraps. Approaching the line,
 * the right half of the plot correctly shows the beginning of the reference
 * lap, and the path never snaps back on itself.
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

export interface WindowPiece {
  /** Lap-local start of this piece, in [0, trackLengthM]. */
  fromM: number;
  /** Lap-local end of this piece, in [0, trackLengthM]. */
  toM: number;
  /**
   * Add to a lap-local distance to get its unwrapped position in the window:
   * -trackLengthM for the previous lap, 0 for this one, +trackLengthM for the
   * next.
   */
  offsetM: number;
}

/** Enough pieces for any window narrower than two laps. */
export const MAX_WINDOW_PIECES = 3;

/** Reusable piece objects so the frame loop never allocates. */
export function createWindowPieces(): WindowPiece[] {
  return Array.from({ length: MAX_WINDOW_PIECES }, () => ({
    fromM: 0,
    toM: 0,
    offsetM: 0,
  }));
}

/**
 * Cut the visible window into lap-local pieces, written into `out` in
 * ascending unwrapped order. Returns how many pieces were written; the rest
 * of `out` is untouched. Zero when the window or lap is degenerate.
 */
export function windowPieces(
  carDistanceM: number,
  metersBehind: number,
  metersAhead: number,
  trackLengthM: number,
  out: WindowPiece[]
): number {
  const lo = carDistanceM - metersBehind;
  const hi = carDistanceM + metersAhead;
  if (!(hi > lo) || !(trackLengthM > 0)) return 0;

  let count = 0;
  for (let k = -1; k <= 1 && count < out.length; k++) {
    const offsetM = k * trackLengthM;
    const fromM = Math.max(lo, offsetM);
    const toM = Math.min(hi, offsetM + trackLengthM);
    if (toM <= fromM) continue;
    const piece = out[count++];
    piece.fromM = fromM - offsetM;
    piece.toM = toM - offsetM;
    piece.offsetM = offsetM;
  }
  return count;
}

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
