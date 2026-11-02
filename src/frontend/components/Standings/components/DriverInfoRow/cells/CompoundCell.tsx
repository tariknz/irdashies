import { memo } from 'react';
import { Compound } from '../../../../shared/Compound/Compound';

interface CompoundCellProps {
  tireCompound?: number;
  /** LMU's four wheels, FL, FR, RL, RR. Undefined where the sim has one. */
  wheelCompounds?: number[];
  carId?: number;
  compactMode?: string;
}

export const CompoundCell = memo(
  ({ tireCompound, wheelCompounds, carId, compactMode }: CompoundCellProps) => {
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
            <Compound
              tireCompound={tireCompound}
              wheelCompounds={wheelCompounds}
            />
          )}
        </div>
      </td>
    );
  }
);

CompoundCell.displayName = 'CompoundCell';
