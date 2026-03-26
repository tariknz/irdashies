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
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';
    const colorClass = showBackground
      ? tailwindStyles.driverIcon
      : showBorder
        ? tailwindStyles.borderColor
        : '';
    const borderWidthClass = showBorder ? 'border-l-4' : '';

    return (
      <td
        data-column="carNumber"
        className={`w-auto ${colorClass} ${borderWidthClass} text-white text-right ${pxClass} whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </td>
    );
  }
);

CarNumberCell.displayName = 'CarNumberCell';
