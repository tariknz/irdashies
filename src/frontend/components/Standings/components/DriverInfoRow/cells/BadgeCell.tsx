import { memo } from 'react';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../DriverRatingBadge/DriverRatingBadge';

interface BadgeCellProps {
  license?: string;
  rating?: number;
  badgeFormat?: DriverRatingBadgeProps['format'];
  isMinimal?: boolean;
}

export const BadgeCell = memo(
  ({ license, rating, badgeFormat, isMinimal }: BadgeCellProps) => (
    <td data-column="badge" className="w-auto whitespace-nowrap text-center">
      <DriverRatingBadge
        license={license}
        rating={rating}
        format={badgeFormat}
        isMinimal={isMinimal}
      />
    </td>
  )
);

BadgeCell.displayName = 'BadgeCell';
