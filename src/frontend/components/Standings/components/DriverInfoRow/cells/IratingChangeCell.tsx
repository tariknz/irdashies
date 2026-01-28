import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  iratingChangeValue?: number;
}

export const IratingChangeCell = memo(
  ({ iratingChangeValue }: IratingChangeCellProps) => (
    <td
      data-column="iratingChange"
      className="w-auto px-2 text-center whitespace-nowrap"
    >
      <RatingChange value={iratingChangeValue} />
    </td>
  )
);

IratingChangeCell.displayName = 'IratingChangeCell';

