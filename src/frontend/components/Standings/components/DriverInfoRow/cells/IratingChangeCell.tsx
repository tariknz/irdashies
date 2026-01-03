import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  hidden?: boolean;
  iratingChangeValue?: number;
}

export const IratingChangeCell = memo(
  ({ hidden, iratingChangeValue }: IratingChangeCellProps) => (
    <td
      data-column="iratingChange"
      className="w-auto px-2 text-center whitespace-nowrap"
    >
      {hidden ? null : <RatingChange value={iratingChangeValue} />}
    </td>
  )
);

IratingChangeCell.displayName = 'IratingChangeCell';

