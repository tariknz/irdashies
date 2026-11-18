import { memo } from 'react';
import {
  RatingBadge,
  type RatingBadgeProps,
} from '../../../../shared/DriverRatingBadge/RatingBadge';

interface BadgeCellProps extends RatingBadgeProps {
  compactMode?: string;
}

export const BadgeCell = memo(({ compactMode, ...badge }: BadgeCellProps) => {
  const pxClass =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'px-1' : 'px-2';
  return (
    <td
      data-column="badge"
      className={`w-auto whitespace-nowrap text-center ${pxClass}`}
    >
      <RatingBadge {...badge} />
    </td>
  );
});

BadgeCell.displayName = 'BadgeCell';
