import { memo } from 'react';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  carId?: number;
  compactMode?: string;
}

export const CarManufacturerCell = memo(
  ({ carId, compactMode }: CarManufacturerCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="carManufacturer"
        className={`w-auto whitespace-nowrap ${pxClass}`}
      >
        <div className="flex items-center justify-center text-center">
          {carId && <CarManufacturer carId={carId} />}
        </div>
      </td>
    );
  }
);

CarManufacturerCell.displayName = 'CarManufacturerCell';
