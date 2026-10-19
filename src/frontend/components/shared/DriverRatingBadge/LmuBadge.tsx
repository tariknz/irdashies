import { LMU_ART_CLASSES, lmuBadgeArt } from './lmuRankArt';

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
 * Art where there is art, and a short label where there is not.
 *
 * The label is deliberately not nothing. A driver the service gave a marker
 * for and a driver it gave none are different facts, and an empty cell says
 * the second while meaning the first -- which is indistinguishable from the
 * column being broken, and cost a long time to tell apart once already. So a
 * known badge with no bundled artwork shows its own name, trimmed of the
 * `sr-` prefix: ugly, but never silent. `tools/fetch-lmu-rank-art.ts`
 * downloads the set; a marker the service adds later needs that run again.
 */
export const LmuBadge = ({ badge }: LmuBadgeProps) => {
  if (!badge) return null;

  const art = lmuBadgeArt(badge);
  if (art) {
    return (
      <img src={art} alt={badge} title={badge} className={LMU_ART_CLASSES} />
    );
  }

  return (
    <span
      title={badge}
      className="text-[0.6em] uppercase tracking-wide text-white/70"
    >
      {badge.replace(/^sr-/, '')}
    </span>
  );
};
