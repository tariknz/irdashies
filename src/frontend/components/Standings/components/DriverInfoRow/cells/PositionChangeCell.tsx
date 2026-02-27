import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface PositionChangeCellProps {
  positionChange?: number;
}

export const PositionChangeCell = memo(
  ({ positionChange }: PositionChangeCellProps) => (
    <td data-column="positionChange" className="w-auto px-2 whitespace-nowrap">
      <RatingChange value={positionChange} justify="start" />
    </td>
  )
);

PositionChangeCell.displayName = 'PositionChangeCell';
