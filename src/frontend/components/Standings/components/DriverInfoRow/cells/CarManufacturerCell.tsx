import { memo } from 'react';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  carId?: number;
}

export const CarManufacturerCell = memo(({ carId }: CarManufacturerCellProps) => (
  <td data-column="carManufacturer" className="w-auto whitespace-nowrap px-2">
    <div className="flex items-center justify-center text-center">
      {carId && <CarManufacturer carId={carId} />}
    </div>
  </td>
));

CarManufacturerCell.displayName = 'CarManufacturerCell';

