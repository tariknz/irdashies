import { memo } from 'react';
import { CarManufacturer } from '../../CarManufacturer/CarManufacturer';

interface CarManufacturerCellProps {
  carId?: number;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const CarManufacturerCell = memo(
  ({
    carId,
    compactMode,
    inRotationGroup = false,
  }: CarManufacturerCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = (
      <div className="flex items-center justify-center text-center">
        {carId && <CarManufacturer carId={carId} />}
      </div>
    );

    if (inRotationGroup) return content;

    return (
      <td
        data-column="carManufacturer"
        className={`w-auto whitespace-nowrap ${pxClass}`}
      >
        {content}
      </td>
    );
  }
);

CarManufacturerCell.displayName = 'CarManufacturerCell';
