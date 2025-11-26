import { memo } from 'react';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  hidden?: boolean;
  tireCompound?: number;
  carId?: number;
}

export const CompoundCell = memo(({ hidden, tireCompound, carId }: CompoundCellProps) => (
  <td data-column="compound" className="w-auto whitespace-nowrap text-center px-2">
    <div className="flex items-center justify-center">
      {hidden ? null : (tireCompound !== undefined && carId !== undefined && <Compound tireCompound={tireCompound} carIdx={carId} />)}
    </div>
  </td>
));

CompoundCell.displayName = 'CompoundCell';
