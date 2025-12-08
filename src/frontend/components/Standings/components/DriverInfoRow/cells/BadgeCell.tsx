import { memo } from 'react';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../../DriverRatingBadge/DriverRatingBadge';

interface BadgeCellProps {
  hidden?: boolean;
  license?: string;
  rating?: number;
  badgeFormat?: DriverRatingBadgeProps['format'];
}

export const BadgeCell = memo(
  ({ hidden, license, rating, badgeFormat }: BadgeCellProps) => (
    <td data-column="badge" className="w-auto whitespace-nowrap text-center">
      {hidden ? null : (
        <DriverRatingBadge
          license={license}
          rating={rating}
          format={badgeFormat}
        />
      )}
    </td>
  )
);

BadgeCell.displayName = 'BadgeCell';

