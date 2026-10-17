import type { LmuDriverRating } from '@irdashies/types';

/**
 * Applies the country-flags toggle to an LMU rating.
 *
 * One `LmuDriverRating` feeds two independently toggleable columns: the flag
 * reads `countryCode`, the rank badge reads everything else. Rather than pass
 * the object twice and have each cell re-derive the gating, the country is
 * stripped here when flags are switched off, so each cell can just render
 * what it is given.
 *
 * Returns undefined when nothing is left, because `BadgeCell` branches on the
 * rating being present at all — handing it an object with every field cleared
 * would suppress the iRacing badge and draw nothing in its place.
 */
export function lmuRatingFor(
  rating: LmuDriverRating | undefined,
  countryFlagsEnabled: boolean
): LmuDriverRating | undefined {
  if (!rating) return undefined;
  if (countryFlagsEnabled) return rating;

  const rest: LmuDriverRating = { ...rating };
  delete rest.countryCode;
  return Object.values(rest).some((value) => value !== undefined)
    ? rest
    : undefined;
}
