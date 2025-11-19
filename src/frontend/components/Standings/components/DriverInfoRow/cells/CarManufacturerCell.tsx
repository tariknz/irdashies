import { memo } from 'react';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  hidden?: boolean;
  carId?: number;
}

export const CarManufacturerCell = memo(({ hidden, carId }: CarManufacturerCellProps) => (
  <td data-column="carManufacturer" className="w-auto whitespace-nowrap">
    <div className="flex items-center justify-center pr-2 text-center">
      {hidden ? null : (carId && <CarManufacturer carId={carId} size="sm" />)}
    </div>
  </td>
));

CarManufacturerCell.displayName = 'CarManufacturerCell';

