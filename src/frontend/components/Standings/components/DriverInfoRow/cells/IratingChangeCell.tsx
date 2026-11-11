import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  iratingChangeValue?: number;
  compactMode?: string;
}

export const IratingChangeCell = memo(
  ({ iratingChangeValue, compactMode }: IratingChangeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    // Starts at the column's padding, like the position change: the column
    // is as wide as its widest change, which is three digits now and then
    // but usually two, so centring left a gap before most values. Any spare
    // width falls after.
    return (
      <td
        data-column="iratingChange"
        className={`w-auto ${pxClass} whitespace-nowrap`}
      >
        <RatingChange value={iratingChangeValue} justify="start" showZero />
      </td>
    );
  }
);

IratingChangeCell.displayName = 'IratingChangeCell';
