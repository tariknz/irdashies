import { memo } from 'react';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../../../shared/DriverRatingBadge/DriverRatingBadge';

interface BadgeCellProps {
  license?: string;
  rating?: number;
  isAi?: boolean;
  badgeFormat?: DriverRatingBadgeProps['format'];
  isMinimal?: boolean;
  compactMode?: string;
}

export const BadgeCell = memo(
  ({
    license,
    rating,
    isAi,
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
        <DriverRatingBadge
          license={license}
          rating={rating}
          isAi={isAi}
          format={badgeFormat}
          isMinimal={isMinimal}
        />
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
