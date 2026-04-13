import { memo } from 'react';
import type { TailwindStyles } from '@irdashies/utils/colors';

interface CarNumberCellProps {
  carNumber?: string;
  tailwindStyles: TailwindStyles;
  showBackground?: boolean;
  showBorder?: boolean;
  compactMode?: string;
}

export const CarNumberCell = memo(
  ({
    carNumber,
    tailwindStyles,
    showBackground = true,
    showBorder = true,
    compactMode,
  }: CarNumberCellProps) => {
    const colorClass = showBackground
      ? tailwindStyles.driverIcon
      : showBorder
        ? tailwindStyles.borderColor
        : '';
    const borderClass = showBorder ? 'border-l-4' : '';
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    return (
      <td
        data-column="carNumber"
        className={`w-auto ${colorClass} ${borderClass} text-white text-right ${pxClass} whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </td>
    );
  }
);

CarNumberCell.displayName = 'CarNumberCell';
