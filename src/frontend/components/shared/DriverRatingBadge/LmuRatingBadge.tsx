import type { LmuDriverRating, LmuRank } from '@irdashies/types';

export interface LmuRatingBadgeProps {
  rating?: LmuDriverRating;
  /** Dimmed palette, matching DriverRatingBadge's minimal mode. */
  isMinimal?: boolean;
  /** Show the safety rank beside the driver rank. */
  showSafety?: boolean;
}

/**
 * A Le Mans Ultimate driver rank, as the sim's own ecosystem scores it.
 *
 * Deliberately a separate component from DriverRatingBadge rather than
 * another `format` on it. The two describe different things: iRacing has a
 * licence class plus a four-digit iRating, LMU has a named rank with a tier
 * inside it and no number at all. Threading LMU through DriverRatingBadge
 * would mean every one of its twelve formats growing a second meaning.
 *
 * Rendered as a text chip rather than the rank plate artwork the sim's own UI
 * uses: that artwork lives on a remote CDN, and a standings row that reaches
 * the network per driver per session is not a trade worth making for an
 * overlay that has to stay cheap. The colours below are taken from the same
 * palette so the two read alike.
 */

/** Rank colours, matching the sim's own. */
const RANK_COLORS: Record<LmuRank, string> = {
  Bronze: 'border-[#C4834A] bg-[#6b4725]',
  Silver: 'border-[#A7ACB2] bg-[#5b5f64]',
  Gold: 'border-[#E3B341] bg-[#7d6220]',
  Platinum: 'border-[#7FD8D2] bg-[#2f6b6b]',
  Pro: 'border-[#B48CFF] bg-[#4b3a80]',
};

const MINIMAL_COLORS: Record<LmuRank, string> = {
  Bronze: 'border-[#4a3119] bg-[#4a3119]',
  Silver: 'border-[#3f4246] bg-[#3f4246]',
  Gold: 'border-[#564316] bg-[#564316]',
  Platinum: 'border-[#204845] bg-[#204845]',
  Pro: 'border-[#342858] bg-[#342858]',
};

/**
 * The short label for a rank.
 *
 * Pro carries no tier, so it reads `PRO`; everything else is the rank's
 * initial plus its tier, e.g. `G3`. A tiered rank with no tier falls back to
 * the bare initial rather than printing a zero.
 */
export const lmuRankLabel = (rank: LmuRank, tier?: number): string => {
  if (rank === 'Pro') return 'PRO';
  return tier && tier > 0 ? `${rank.charAt(0)}${tier}` : rank.charAt(0);
};

const Chip = ({
  rank,
  tier,
  isMinimal,
  title,
}: {
  rank: LmuRank;
  tier?: number;
  isMinimal?: boolean;
  title: string;
}) => (
  <div
    title={title}
    className={`text-white text-center text-nowrap border-2 px-1 rounded-md text-xs leading-tight min-w-[1.8em] ${
      (isMinimal ? MINIMAL_COLORS : RANK_COLORS)[rank]
    }`}
  >
    {lmuRankLabel(rank, tier)}
  </div>
);

export const LmuRatingBadge = ({
  rating,
  isMinimal,
  showSafety = true,
}: LmuRatingBadgeProps) => {
  const driverRank = rating?.driverRank;
  const safetyRank = showSafety ? rating?.safetyRank : undefined;

  // No rank at all is the common case for an AI entry, and for any human the
  // rating service does not know. An empty cell is correct -- a placeholder
  // would imply a rating that does not exist.
  if (!driverRank && !safetyRank) return null;

  return (
    <div className="flex gap-1 items-center justify-center mx-2">
      {driverRank && (
        <Chip
          rank={driverRank}
          tier={rating?.driverTier}
          isMinimal={isMinimal}
          title={`Driver rating: ${driverRank}${
            rating?.driverTier ? ` ${rating.driverTier}` : ''
          }`}
        />
      )}
      {safetyRank && (
        <Chip
          rank={safetyRank}
          tier={rating?.safetyTier}
          isMinimal={isMinimal}
          title={`Safety rating: ${safetyRank}${
            rating?.safetyTier ? ` ${rating.safetyTier}` : ''
          }`}
        />
      )}
    </div>
  );
};
