import { memo } from 'react';
import { CarManufacturer } from '../../../../shared/CarManufacturer/CarManufacturer';

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
          {/*
            Unguarded on purpose, like CountryFlagsCell: `{carId && ...}` put
            the *number* 0 in the cell for any car whose marque did not
            resolve, because a falsy non-boolean left of `&&` reaches the DOM
            as text. CarManufacturer returns null when it has no badge to
            draw, which is the only place that knows.
          */}
          <CarManufacturer carId={carId ?? 0} />
        </div>
      </td>
    );
  }
);

CarManufacturerCell.displayName = 'CarManufacturerCell';
