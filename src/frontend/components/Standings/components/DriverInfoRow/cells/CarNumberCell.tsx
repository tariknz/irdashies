import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
  borderColor: string;
}

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
    const borderWidthClass = showBorder ? 'border-l-4' : '';

    return (
      <td
        data-column="carNumber"
        className={`w-auto ${colorClass} ${borderWidthClass} text-white text-right px-1 whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </td>
    );
  }
);

CarNumberCell.displayName = 'CarNumberCell';
