import { memo } from 'react';
import type { TailwindStyles } from '@irdashies/utils/colors';

interface CarNumberCellProps {
  carNumber?: string;
  tailwindStyles: TailwindStyles;
  showBackground?: boolean;
  showBorder?: boolean;
}

export const CarNumberCell = memo(
  ({
    carNumber,
    tailwindStyles,
    showBackground = true,
    showBorder = true,
  }: CarNumberCellProps) => {
    const colorClass = showBackground
      ? tailwindStyles.driverIcon
      : showBorder
        ? tailwindStyles.borderColor
        : '';
    const borderClass = showBorder ? 'border-l-4' : '';

    return (
      <td
        data-column="carNumber"
        className={`w-auto ${colorClass} ${borderClass} text-white text-right px-1 whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </td>
    );
  }
);

CarNumberCell.displayName = 'CarNumberCell';
