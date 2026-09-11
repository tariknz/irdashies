/** Plot geometry in SVG viewBox units. */
export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 180;

/** Vertical band the traces are drawn in. */
export const PLOT_TOP = 8;
export const PLOT_BOTTOM = 168;
export const PLOT_H = PLOT_BOTTOM - PLOT_TOP;

/**
 * Headroom above 1.0, so a live lap faster than the reference's top speed
 * stays visible instead of clipping into the frame edge.
 *
 * Only above. The scale's floor is the reference lap's slowest point, which is
 * not a floor the driver shares: stopped in the pits, or slower than the
 * reference was anywhere, reads as a negative value. Given headroom below, that
 * drew the speed trace as a flat line under the axis until the car passed the
 * reference's minimum — which on a fast circuit is well into third gear.
 */
export const SCALE_MARGIN = 0.05;

/** Gear text by raw iRacing gear + 1, so -1 -> 'R' and 0 -> 'N'. */
export const GEAR_LABELS = Object.freeze([
  'R',
  'N',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
]);

/**
 * Size of the pre-rendered gear label pool. Enough to cover a technical section
 * in the widest supported window; anything beyond is simply not labelled.
 */
export const MAX_GEAR_LABELS = 24;

/**
 * Markers visible at once per kind. A 400 m window holds a handful of corners,
 * so 8 is generous; anything beyond is simply not drawn.
 */
export const MAX_MARKERS = 8;

/**
 * Height of the optional ABS strip, just under the trace band and above the
 * application markers so the two do not sit on top of each other.
 */
export const ABS_BAR_Y = PLOT_BOTTOM + 4;

/**
 * How far back from a corner's start to look for a lap's brake point for that
 * corner. Long enough for a braking zone from top speed, which can begin 250 m
 * out — a reach that would be reckless for a per-corner window, but is safe
 * because attribution is exclusive and runs in track order, so an earlier
 * corner always claims its own point first (see assignCornerBrakePoints).
 *
 * The driver's own application is looked for in the same stretch, so the two
 * sides of a brake-point delta are drawn from the same piece of road (see
 * compareCornerBrakePoint).
 */
export const BRAKE_POINT_LOOKBACK_M = 400;

/**
 * Map a normalised 0..1 channel value to a y coordinate.
 *
 * Values below the band sit on its floor rather than below it: zero speed is
 * as slow as a car gets, so there is nothing informative to show down there,
 * and a line under the axis reads as a fault rather than as "stopped".
 */
export function yForNorm(value: number): number {
  const clamped = Math.max(0, Math.min(1 + SCALE_MARGIN, value));
  return PLOT_BOTTOM - clamped * PLOT_H;
}
