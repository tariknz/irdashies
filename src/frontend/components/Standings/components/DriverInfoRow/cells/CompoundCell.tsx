import { memo } from 'react';
import { Compound } from '../../Compound/Compound';

interface CompoundCellProps {
  hidden?: boolean;
  tireCompound?: number;
  carId?: number;
}

export const CompoundCell = memo(({ hidden, tireCompound, carId }: CompoundCellProps) => (
  <td data-column="compound" className="w-auto whitespace-nowrap text-center">
    <div className="flex items-center justify-center pr-1">
      {hidden ? null : (tireCompound !== undefined && carId && <Compound tireCompound={tireCompound} carId={carId} size="sm" />)}
    </div>
  </td>
));

CompoundCell.displayName = 'CompoundCell';

