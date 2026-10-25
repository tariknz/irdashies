import { memo } from 'react';
import { LmuBadge } from '../../../../shared/DriverRatingBadge/LmuBadge';

interface LmuBadgeCellProps {
  /** The marker from LmuRating.badge; absent on every sim but LMU. */
  badge?: string;
  compactMode?: string;
}

/**
 * The LMU achievement badge column.
 *
 * Its own column rather than riding along with the rank pair, so it can be
 * turned off on its own. Renders an empty cell on any other sim, and for an
 * LMU driver the service has no badge for -- which is most of a grid.
 */
export const LmuBadgeCell = memo(
  ({ badge, compactMode }: LmuBadgeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="lmuBadge"
        className={`w-auto whitespace-nowrap text-center ${pxClass}`}
      >
        <LmuBadge badge={badge} />
      </td>
    );
  }
);

LmuBadgeCell.displayName = 'LmuBadgeCell';
