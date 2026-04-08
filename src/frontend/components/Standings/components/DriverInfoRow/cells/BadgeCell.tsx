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
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const BadgeCell = memo(
  ({
    license,
    rating,
    badgeFormat,
    isMinimal,
    compactMode,
    inRotationGroup = false,
  }: BadgeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = (
      <DriverRatingBadge
        license={license}
        rating={rating}
        format={badgeFormat}
        isMinimal={isMinimal}
      />
    );

    if (inRotationGroup) return content;

    return (
      <td
        data-column="badge"
        className={`w-auto whitespace-nowrap text-center ${pxClass}`}
      >
        {content}
      </td>
    );
  }
);

BadgeCell.displayName = 'BadgeCell';
