import type { LmuBadgeFormat } from '@irdashies/types';
import { memo } from 'react';
import type { LmuDriverRating } from '@irdashies/types';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../../../shared/DriverRatingBadge/DriverRatingBadge';
import { LmuRatingBadge } from '../../../../shared/DriverRatingBadge/LmuRatingBadge';

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
        {lmuRating ? (
          // Its own setting: the iRacing formats describe a licence and an
          // iRating, which maps onto nothing in a named rank with a tier.
          <LmuRatingBadge
            rating={lmuRating}
            isMinimal={isMinimal}
            format={lmuFormat}
          />
        ) : hasDriverRatings ? (
          // Which sim is running, not what this driver happens to carry. The
          // iRacing badge reads a missing licence and iRating as an AI entry,
          // which is right for iRacing and wrong for every other sim -- under
          // LMU nobody has either, so it labelled the whole grid "AI", and a
          // human whose rank had not arrived yet was called an AI until it
          // did.
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
