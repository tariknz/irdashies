import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
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
  ({ license, rating, badgeFormat, isMinimal }: BadgeCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
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
          isMinimal={isMinimal}
        />
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
