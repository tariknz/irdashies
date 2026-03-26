import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface PositionChangeCellProps {
  positionChange?: number;
  compactMode?: string;
}

export const PositionChangeCell = memo(
  ({ positionChange, compactMode }: PositionChangeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="positionChange"
        className={`w-auto ${pxClass} whitespace-nowrap`}
      >
        <RatingChange value={positionChange} justify="start" />
      </td>
    );
  }
);

PositionChangeCell.displayName = 'PositionChangeCell';
