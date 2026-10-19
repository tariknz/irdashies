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
   * Present only when the running sim is LMU. Takes over the cell entirely:
   * LMU has no iRating or licence, so the iRacing badge would draw its "AI"
   * placeholder for every driver on the grid.
   */
  lmuRating?: LmuDriverRating;
  badgeFormat?: DriverRatingBadgeProps['format'];
  /** How to draw the LMU rank pair; ignored on every other sim. */
  lmuFormat?: LmuBadgeFormat;
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
        ) : (
          <DriverRatingBadge
            license={license}
            rating={rating}
            format={badgeFormat}
            isMinimal={isMinimal}
          />
        )}
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
