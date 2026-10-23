/**
 * Le Mans Ultimate driver ratings, as the sim's own ecosystem reports them.
 *
 * LMU keeps no rating of its own in shared memory and publishes no incident
 * count, so there is nothing here that maps onto iRacing's iRating/licence
 * pair. The figures come from the rating service the sim authenticates
 * against, keyed on Steam ID, and they are shaped quite differently: a named
 * rank (Bronze..Platinum, or Pro) with a numeric tier inside it, plus a
 * separate safety rank on the same scale.
 *
 * Kept in `src/types` rather than beside the fetcher because the renderer
 * needs the shape and must never import from `src/app` (ARCHITECTURE_RULES N2).
 */

/**
 * The rank names the service issues.
 *
 * `Pro` is deliberately outside the tiered set: it has no tier and no rank
 * artwork, so it is rendered as a plain label.
 */
export const LMU_TIERED_RANKS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
] as const;

export type LmuTieredRank = (typeof LMU_TIERED_RANKS)[number];
export type LmuRank = LmuTieredRank | 'Pro';

export const isLmuTieredRank = (value: string): value is LmuTieredRank =>
  (LMU_TIERED_RANKS as readonly string[]).includes(value);

/**
 * How to draw an LMU driver's rank pair.
 *
 * Its own setting rather than a thirteenth entry in the iRacing badge formats:
 * those twelve describe a licence class beside a four-digit iRating, and none
 * of them maps onto a named rank with a tier. The two sims get a dropdown
 * each.
 *
 * `plates` is the sim's own artwork. The rest are the text chips, differing
 * only in which of the pair keeps its background and border -- a driver
 * rating is the one most people want to pick out at a glance, and a safety
 * rating reads as noise beside it for some.
 */
export const LMU_BADGE_FORMATS = [
  'plates',
  'chip-both',
  'chip-dr',
  'chip-sr',
  'chip-none',
] as const;

export type LmuBadgeFormat = (typeof LMU_BADGE_FORMATS)[number];

/** Which of the pair is drawn with a background and border. */
export const lmuChipChrome = (
  format: LmuBadgeFormat | undefined
): { driver: boolean; safety: boolean } => {
  switch (format) {
    case 'chip-dr':
      return { driver: true, safety: false };
    case 'chip-sr':
      return { driver: false, safety: true };
    case 'chip-none':
      return { driver: false, safety: false };
    // chip-both, and anything unrecognised: the fuller rendering is the safer
    // default, since a chip without chrome on an unexpected background could
    // be unreadable.
    default:
      return { driver: true, safety: true };
  }
};

/**
 * One driver's standing. Every field is optional: the service answers for the
 * drivers it knows, and an AI entry or an unregistered human simply has none.
 */
export interface LmuDriverRating {
  /** Driver rating rank, e.g. 'Gold'. */
  driverRank?: LmuRank;
  /** Tier within `driverRank`; 0 or absent when the rank carries no tier. */
  driverTier?: number;
  /** Safety rating rank, on the same scale as `driverRank`. */
  safetyRank?: LmuRank;
  safetyTier?: number;
  /**
   * An awarded badge's identifier, e.g. a licence or championship marker.
   * Opaque: it is a key into the service's own artwork, not something to
   * interpret.
   */
  badge?: string;
  /**
   * ISO 3166-1 alpha-2, upper case, already normalised from whatever the
   * service reported. Feeds the country flag.
   */
  countryCode?: string;
}

/** True when there is anything worth rendering. */
export const hasLmuRating = (rating?: LmuDriverRating): boolean =>
  !!rating &&
  (!!rating.driverRank ||
    !!rating.safetyRank ||
    !!rating.badge ||
    !!rating.countryCode);
