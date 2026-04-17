import { memo } from 'react';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  tireCompound?: number;
  carId?: number;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const CompoundCell = memo(
  ({
    tireCompound,
    carId,
    compactMode,
    inRotationGroup = false,
  }: CompoundCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = (
      <div className="flex items-center justify-center">
        {tireCompound !== undefined && carId !== undefined && (
          <Compound tireCompound={tireCompound} />
        )}
      </div>
    );

    if (inRotationGroup) return content;

    return (
      <td
        data-column="compound"
        className={`w-auto whitespace-nowrap text-center ${pxClass}`}
      >
        {content}
      </td>
    );
  }
);

CompoundCell.displayName = 'CompoundCell';
