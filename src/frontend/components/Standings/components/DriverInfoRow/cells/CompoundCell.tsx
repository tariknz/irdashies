import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  tireCompound?: number;
  carId?: number;
}

export const CompoundCell = memo(
  ({ tireCompound, carId }: CompoundCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="compound"
        className={`w-auto whitespace-nowrap text-center ${pxClass}`}
      >
        <div className="flex items-center justify-center">
          {tireCompound !== undefined && carId !== undefined && (
            <Compound tireCompound={tireCompound} />
          )}
        </div>
      </td>
    );
  }
);

CompoundCell.displayName = 'CompoundCell';
