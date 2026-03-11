import { memo } from 'react';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  tireCompound?: number;
  carId?: number;
}

export const CompoundCell = memo(({ tireCompound, carId }: CompoundCellProps) => (
  <td data-column="compound" className="w-auto whitespace-nowrap text-center px-2">
    <div className="flex items-center justify-center">
      {tireCompound !== undefined && carId !== undefined && <Compound tireCompound={tireCompound} />}
    </div>
  </td>
));

CompoundCell.displayName = 'CompoundCell';
