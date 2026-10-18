import { lmuBadgeArt } from './lmuRankArt';

export interface LmuBadgeProps {
  /**
   * The marker the rating service reports in `profile.badge`, e.g. `sr-saint`.
   * Opaque: a key into the service's artwork, not something to interpret.
   */
  badge?: string;
}

/**
 * One LMU achievement badge.
 *
 * Its own column rather than part of LmuRatingBadge, because it answers a
 * different question: the rank pair is where a driver stands, this is a marker
 * they have been given, and either can be wanted without the other.
 *
 * Art only. The badge string is a key, not a label -- `sr-saint` is not
 * something to print in a standings row -- so a badge with no bundled artwork
 * renders nothing rather than its own name. `tools/fetch-lmu-rank-art.ts`
 * downloads the set; a marker the service adds later needs that run again.
 */
export const LmuBadge = ({ badge }: LmuBadgeProps) => {
  const art = lmuBadgeArt(badge);
  if (!art) return null;

  return (
    <img
      src={art}
      alt={badge}
      title={badge}
      className="h-[1.5em] w-auto shrink-0"
    />
  );
};
