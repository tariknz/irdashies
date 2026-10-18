/**
 * Whether the LMU rank pair should be drawn as the sim's plates or as text.
 *
 * The badge-format setting was built for iRacing, where its twelve options
 * describe a licence class and a four-digit iRating. None of that maps onto a
 * named rank with a tier, so rather than grow a thirteenth option and a second
 * meaning for the other twelve, LMU reads the same setting as a single
 * question: the first option means the sim's artwork, everything else means
 * text.
 *
 * Kept as a named function with the format spelled out once, so the choice is
 * searchable and the string is not scattered across two widgets.
 */

/** The first entry of StandingsBadgeFormat and of RelativeBadgeFormat alike. */
export const LMU_ART_BADGE_FORMAT = 'license-color-fullrating-combo';

export const lmuUsesRankArt = (badgeFormat?: string): boolean =>
  badgeFormat === LMU_ART_BADGE_FORMAT;
