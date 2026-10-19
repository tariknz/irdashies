import {
  lmuChipChrome,
  type LmuBadgeFormat,
  type LmuDriverRating,
  type LmuRank,
} from '@irdashies/types';
import { lmuRankArt, type LmuRankKind } from './lmuRankArt';
import { LmuSprite } from './LmuSprite';

export interface LmuRatingBadgeProps {
  rating?: LmuDriverRating;
  /** Dimmed palette, matching DriverRatingBadge's minimal mode. */
  isMinimal?: boolean;
  /** Show the safety rank beside the driver rank. */
  showSafety?: boolean;
  /**
   * How to draw the pair: the sim's plates, or chips with the background and
   * border on either, both or neither. See LmuBadgeFormat.
   *
   * Plates fall back per rank, not per row: `Pro` has no plate in the bucket,
   * so it reads as a chip even here, and a rank whose art is missing does the
   * same rather than leaving a gap where a rating should be.
   */
  format?: LmuBadgeFormat;
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
 * Two ways to draw it, chosen by `format`. The text chips are cheap and
 * cost nothing: a rank initial and its tier, coloured from the sim's own
 * palette. The plates are the sim's real artwork, bundled under `assets/lmu/`
 * rather than fetched -- a standings row reaching a CDN per driver per session
 * is not a trade an overlay should make. See lmuRankArt.ts.
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

/** Rank colours for a chip carrying no background, where the text is all there is. */
const BARE_COLORS: Record<LmuRank, string> = {
  Bronze: 'text-[#C4834A]',
  Silver: 'text-[#A7ACB2]',
  Gold: 'text-[#E3B341]',
  Platinum: 'text-[#7FD8D2]',
  Pro: 'text-[#B48CFF]',
};

const Chip = ({
  rank,
  tier,
  isMinimal,
  title,
  chrome = true,
}: {
  rank: LmuRank;
  tier?: number;
  isMinimal?: boolean;
  title: string;
  /** Draw the background and border. Without it the text carries the rank. */
  chrome?: boolean;
}) => (
  <div
    title={title}
    className={
      chrome
        ? `text-white text-center text-nowrap border-2 px-1 rounded-md text-xs leading-tight min-w-[1.8em] ${
            (isMinimal ? MINIMAL_COLORS : RANK_COLORS)[rank]
          }`
        : // No plate and no chrome, so the colour has to move to the text or
          // the rank becomes unreadable at a glance.
          `text-center text-nowrap px-1 text-xs leading-tight min-w-[1.8em] ${BARE_COLORS[rank]}`
    }
  >
    {lmuRankLabel(rank, tier)}
  </div>
);

/**
 * One rank, as a plate when there is art for it and as a chip when not.
 *
 * Drawn from a sprite sheet rather than as its own image: see lmuRankArt.ts
 * for why, and LmuSprite for how. Sized by height so a row's line height
 * decides how big it is, with the aspect carried by the cell.
 */
const Plate = ({
  kind,
  rank,
  tier,
  isMinimal,
  title,
}: {
  kind: LmuRankKind;
  rank: LmuRank;
  tier?: number;
  isMinimal?: boolean;
  title: string;
}) => {
  const art = lmuRankArt(kind, rank, tier);
  if (!art)
    return <Chip rank={rank} tier={tier} isMinimal={isMinimal} title={title} />;
  return <LmuSprite cell={art} title={title} />;
};

export const LmuRatingBadge = ({
  rating,
  isMinimal,
  showSafety = true,
  format = 'plates',
}: LmuRatingBadgeProps) => {
  const driverRank = rating?.driverRank;
  const safetyRank = showSafety ? rating?.safetyRank : undefined;

  // No rank at all is the common case for an AI entry, and for any human the
  // rating service does not know. An empty cell is correct -- a placeholder
  // would imply a rating that does not exist.
  if (!driverRank && !safetyRank) return null;

  const driverTitle = `Driver rating: ${driverRank}${
    rating?.driverTier ? ` ${rating.driverTier}` : ''
  }`;
  const safetyTitle = `Safety rating: ${safetyRank}${
    rating?.safetyTier ? ` ${rating.safetyTier}` : ''
  }`;

  const useArt = format === 'plates';
  const chrome = lmuChipChrome(format);

  return (
    <div className="flex gap-1 items-center justify-center mx-2">
      {driverRank &&
        (useArt ? (
          <Plate
            kind="dr"
            rank={driverRank}
            tier={rating?.driverTier}
            isMinimal={isMinimal}
            title={driverTitle}
          />
        ) : (
          <Chip
            rank={driverRank}
            tier={rating?.driverTier}
            isMinimal={isMinimal}
            title={driverTitle}
            chrome={chrome.driver}
          />
        ))}
      {safetyRank &&
        (useArt ? (
          <Plate
            kind="sr"
            rank={safetyRank}
            tier={rating?.safetyTier}
            isMinimal={isMinimal}
            title={safetyTitle}
          />
        ) : (
          <Chip
            rank={safetyRank}
            tier={rating?.safetyTier}
            isMinimal={isMinimal}
            title={safetyTitle}
            chrome={chrome.safety}
          />
        ))}
    </div>
  );
};
