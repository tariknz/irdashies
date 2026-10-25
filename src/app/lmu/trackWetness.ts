/**
 * LMU's wetness fraction, expressed as the track-wetness level the app reads.
 *
 * The two sims measure the same thing on different scales. LMU inherits rF2's
 * `mAvgPathWetness`: a continuous 0..1 fraction of how wet the racing line is.
 * iRacing reports a seven-step category, and every consumer here was written
 * against that -- `useTrackWetness` and `WeatherTrackWetness` both index a
 * `Record<number, string>` keyed 1..7.
 *
 * So handing the fraction over unconverted produced nothing at all: a dry
 * track sent 0 and rendered blank, a soaked one sent 0.6 and missed every key,
 * and only an exact 1.0 rendered -- as "Dry". Both widgets were dead for LMU
 * from the moment they were wired up.
 *
 * Converting here rather than in the widgets, because the whole point of the
 * LMU mappers is that the frontend sees one shape. `SessionBarProcessor` reads
 * `TrackWetness` off the frame and both consumers take it from the snapshot it
 * builds, so this one conversion covers them.
 */

/** iRacing's TrackWetness, which this maps onto. 0 means "unknown". */
export const TRACK_WETNESS_DRY = 1;
export const TRACK_WETNESS_EXTREMELY_WET = 7;

/**
 * Upper bounds of each level above Dry, as a fraction of maximum wetness.
 *
 * A judgement call: iRacing's levels are qualitative and it publishes no
 * moisture figure to calibrate against, so there is no conversion to be
 * derived -- only a monotone one that puts the boundaries where a driver would
 * notice the difference. Hence the bunching at the bottom. The first tenth of
 * the scale is where a track goes from fully dry to needing a different line,
 * and spreading seven even steps over 0..1 would have called a greasy track
 * "Dry" and reported "Mostly Dry" in standing water.
 *
 * Index 0 is the top of Mostly Dry (level 2); anything above the last entry is
 * Extremely Wet.
 */
const LEVEL_CEILINGS = [0.05, 0.12, 0.25, 0.45, 0.7] as const;

/** Below this the track is reported Dry, absorbing sensor noise around zero. */
const DRY_CEILING = 0.01;

/**
 * The level for a wetness fraction.
 *
 * Never returns 0: an out-of-range or non-finite reading becomes Dry rather
 * than "unknown", because the frame always carries a number and a blank cell
 * in the middle of a session reads as a broken overlay rather than as missing
 * data.
 */
export const lmuTrackWetness = (fraction: number | undefined): number => {
  if (typeof fraction !== 'number' || !Number.isFinite(fraction)) {
    return TRACK_WETNESS_DRY;
  }
  if (fraction <= DRY_CEILING) return TRACK_WETNESS_DRY;

  const step = LEVEL_CEILINGS.findIndex((ceiling) => fraction <= ceiling);
  return step === -1
    ? TRACK_WETNESS_EXTREMELY_WET
    : TRACK_WETNESS_DRY + 1 + step;
};
