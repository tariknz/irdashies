import { memo } from 'react';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  tireCompound?: number;
  carId?: number;
  compactMode?: string;
}

export const CompoundCell = memo(
  ({ tireCompound, carId, compactMode }: CompoundCellProps) => {
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
