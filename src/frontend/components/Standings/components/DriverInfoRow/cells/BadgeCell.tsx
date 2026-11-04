import type { LmuBadgeFormat } from '@irdashies/types';
import { memo } from 'react';
import type { LmuDriverRating } from '@irdashies/types';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../../../shared/DriverRatingBadge/DriverRatingBadge';
import {
  LmuRatingBadge,
  lmuHasRanks,
} from '../../../../shared/DriverRatingBadge/LmuRatingBadge';

interface BadgeCellProps {
  license?: string;
  rating?: number;
  /**
   * Present only when the running sim is LMU, and only once that driver's rank
   * has been resolved. Absent for an AI entry, for a human the rating service
   * does not know, and for every human in the seconds before the lookup
   * answers -- so its absence cannot be read as "this is not an LMU driver".
   */
  lmuRating?: LmuDriverRating;
  badgeFormat?: DriverRatingBadgeProps['format'];
  /** How to draw the LMU rank pair; ignored on every other sim. */
  lmuFormat?: LmuBadgeFormat;
  /**
   * Whether the running sim reports an iRacing-style licence and rating.
   *
   * Resolved by the widget from the active simulator and passed down, like
   * `hiddenColumns`, so a row stays driven by props and a spec rendering one
   * needs no context. True by default, matching simulatorHasDriverRatings:
   * with no sim detected, hiding would be a guess.
   */
  hasDriverRatings?: boolean;
  /**
   * Whether the sim drives this entry rather than a person.
   *
   * Names an AI as one on a sim that has no ratings, where there is no licence
   * or iRating to infer it from. Distinct from `hasDriverRatings`, which is a
   * property of the sim: together they separate "an AI, say so" from "a human
   * whose rank has not arrived, say nothing".
   */
  isAI?: boolean;
  isMinimal?: boolean;
  compactMode?: string;
}

export const BadgeCell = memo(
  ({
    license,
    rating,
    lmuRating,
    badgeFormat,
    lmuFormat,
    hasDriverRatings = true,
    isAI,
    isMinimal,
    compactMode,
  }: BadgeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="badge"
        className={`w-auto whitespace-nowrap text-center ${pxClass}`}
      >
        {lmuHasRanks(lmuRating) ? (
          // Its own setting: the iRacing formats describe a licence and an
          // iRating, which maps onto nothing in a named rank with a tier.
          //
          // Keyed on there being a rank, not on the LmuRating existing: an
          // entry can carry a country with no rank, and that badge draws
          // nothing for it -- which would swallow the AI placeholder below.
          <LmuRatingBadge
            rating={lmuRating}
            isMinimal={isMinimal}
            format={lmuFormat}
          />
        ) : hasDriverRatings || isAI ? (
          // Two different reasons to reach the iRacing badge.
          //
          // Under iRacing it is simply the badge, and it reads a missing
          // licence and iRating as an AI entry. Under a sim with no ratings
          // that inference is wrong -- nobody has either, so it labelled the
          // whole grid "AI" and called a human an AI until their rank arrived
          // -- but the placeholder itself is still what an AI should show, so
          // it is reached only for an entry the sim says it drives.
          <DriverRatingBadge
            license={license}
            rating={rating}
            format={badgeFormat}
            isMinimal={isMinimal}
          />
        ) : null}
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
