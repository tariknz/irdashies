import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  carId?: number;
}

export const CarManufacturerCell = memo(
  ({ carId }: CarManufacturerCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
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
