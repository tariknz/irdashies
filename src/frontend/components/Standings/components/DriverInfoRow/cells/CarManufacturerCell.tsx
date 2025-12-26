import { memo } from 'react';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  hidden?: boolean;
  carId?: number;
}

export const CarManufacturerCell = memo(({ hidden, carId }: CarManufacturerCellProps) => (
  <td data-column="carManufacturer" className="w-auto whitespace-nowrap px-2">
    <div className="flex items-center justify-center text-center scale-125">
      {hidden ? null : (carId && <CarManufacturer carId={carId} />)}
    </div>
  </td>
));

CarManufacturerCell.displayName = 'CarManufacturerCell';

