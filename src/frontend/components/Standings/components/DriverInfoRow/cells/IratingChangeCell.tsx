import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  iratingChangeValue?: number;
}

export const IratingChangeCell = memo(
  ({ iratingChangeValue }: IratingChangeCellProps) => (
    // Starts close to the column before it: the column is as wide as its
    // widest change, which is three digits now and then but usually two, so
    // centring left a gap before most values. Any spare width falls after.
    <td
      data-column="iratingChange"
      className="w-auto pl-1 pr-2 whitespace-nowrap"
    >
      <RatingChange value={iratingChangeValue} justify="start" showZero />
    </td>
  )
);

IratingChangeCell.displayName = 'IratingChangeCell';
