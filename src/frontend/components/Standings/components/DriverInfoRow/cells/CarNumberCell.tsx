import { memo } from 'react';
import type { TailwindStyles } from '@irdashies/utils/colors';

interface CarNumberCellProps {
  carNumber?: string;
  tailwindStyles: TailwindStyles;
  showBackground?: boolean;
  showBorder?: boolean;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const CarNumberCell = memo(
  ({
    carNumber,
    tailwindStyles,
    showBackground = true,
    showBorder = true,
    compactMode,
    inRotationGroup = false,
  }: CarNumberCellProps) => {
    const colorClass = showBackground
      ? tailwindStyles.driverIcon
      : showBorder
        ? tailwindStyles.borderColor
        : '';
    const borderClass = showBorder ? 'border-l-4' : '';
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    const content = (
      <div
        className={`w-full h-full flex items-center justify-center ${colorClass} ${borderClass} text-white whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </div>
    );

    if (inRotationGroup) return content;

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
