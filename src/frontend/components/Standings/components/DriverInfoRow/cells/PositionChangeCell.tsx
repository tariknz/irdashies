import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface PositionChangeCellProps {
  positionChange?: number;
}

export const PositionChangeCell = memo(
  ({ positionChange }: PositionChangeCellProps) => (
    <td
      data-column="positionChange"
      className="w-auto px-2 text-center whitespace-nowrap"
    >
      <RatingChange value={positionChange} />
    </td>
  )
);

PositionChangeCell.displayName = 'PositionChangeCell';
