import { memo } from 'react';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../DriverRatingBadge/DriverRatingBadge';

interface BadgeCellProps {
  license?: string;
  rating?: number;
  badgeFormat?: DriverRatingBadgeProps['format'];
  compactMode?: string;
}

export const BadgeCell = memo(
  ({ license, rating, badgeFormat, compactMode }: BadgeCellProps) => {
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
          format={badgeFormat}
        />
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
