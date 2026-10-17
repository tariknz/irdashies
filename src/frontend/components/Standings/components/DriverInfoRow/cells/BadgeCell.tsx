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
  isMinimal?: boolean;
  compactMode?: string;
}

export const BadgeCell = memo(
  ({
    license,
    rating,
    lmuRating,
    badgeFormat,
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
          <LmuRatingBadge rating={lmuRating} isMinimal={isMinimal} />
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
