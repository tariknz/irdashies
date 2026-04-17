import { memo } from 'react';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  iratingChangeValue?: number;
  inRotationGroup?: boolean;
}

export const IratingChangeCell = memo(
  ({ iratingChangeValue, inRotationGroup = false }: IratingChangeCellProps) => {
    const content = <RatingChange value={iratingChangeValue} showZero />;

    if (inRotationGroup) return content;

    return (
      <td
        data-column="iratingChange"
        className="w-auto px-2 text-center whitespace-nowrap"
      >
        {content}
      </td>
    );
  }
);

IratingChangeCell.displayName = 'IratingChangeCell';
