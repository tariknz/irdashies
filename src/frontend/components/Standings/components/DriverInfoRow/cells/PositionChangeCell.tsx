import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface PositionChangeCellProps {
  positionChange?: number;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const PositionChangeCell = memo(
  ({
    positionChange,
    compactMode,
    inRotationGroup = false,
  }: PositionChangeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = <RatingChange value={positionChange} justify="start" />;

    if (inRotationGroup) return content;

    return (
      <td
        data-column="positionChange"
        className={`w-auto ${pxClass} whitespace-nowrap`}
      >
        {content}
      </td>
    );
  }
);

PositionChangeCell.displayName = 'PositionChangeCell';
