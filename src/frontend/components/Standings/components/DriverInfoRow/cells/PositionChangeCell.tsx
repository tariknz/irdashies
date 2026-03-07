import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { RatingChange } from '../../RatingChange/RatingChange';

interface PositionChangeCellProps {
  positionChange?: number;
}

export const PositionChangeCell = memo(
  ({ positionChange }: PositionChangeCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
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
