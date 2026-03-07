import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { RatingChange } from '../../RatingChange/RatingChange';

interface IratingChangeCellProps {
  iratingChangeValue?: number;
}

export const IratingChangeCell = memo(
  ({ iratingChangeValue }: IratingChangeCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="iratingChange"
        className={`w-auto ${pxClass} text-center whitespace-nowrap`}
      >
        <RatingChange value={iratingChangeValue} />
      </td>
    );
  }
);

IratingChangeCell.displayName = 'IratingChangeCell';
