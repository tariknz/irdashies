/**
 * LMU's track-limits penalty points, in the sim's own form.
 *
 * The sim reads `0.25 / 3.00`: a quarter of a point accumulated against a
 * ceiling of three, where a drive-through is served. Both numbers carry two
 * decimals because that is how the sim writes them, and matching it means a
 * figure read off the overlay and a figure read off the sim's own HUD cannot
 * disagree about what they are.
 *
 * Shared by the two places that show it -- the Track Limits item and, for LMU,
 * the Incident Count item -- so the two cannot drift apart.
 */

/** Amber from two thirds of the ceiling, red at it. Matches TrackLimitsCell. */
const WARN_FRACTION = 2 / 3;

/**
 * `0.25 / 3.00`, or `0.25 / –` when the session has not stated a ceiling.
 *
 * A dash rather than `0.00`, which would read as a penalty served at nothing.
 */
export const formatTrackLimits = (
  points: number,
  max: number | undefined
): string => `${points.toFixed(2)} / ${max ? max.toFixed(2) : '–'}`;

/** The Tailwind text colour for how close the figure is to the ceiling. */
export const trackLimitsTone = (
  points: number,
  max: number | undefined
): string => {
  if (!max || max <= 0) return '';
  if (points >= max) return 'text-red-400';
  if (points >= max * WARN_FRACTION) return 'text-amber-300';
  return '';
};
