import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
}

interface CarNumberCellProps {
  carNumber?: string;
  tailwindStyles: TailwindStyles;
  compactMode?: string;
}

export const CarNumberCell = memo(
  ({ carNumber, tailwindStyles, compactMode }: CarNumberCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';
    return (
      <td
        data-column="carNumber"
        className={`w-auto ${tailwindStyles.driverIcon} border-l-4 text-white text-right ${pxClass} whitespace-nowrap`}
      >
        {`#${carNumber}`}
      </td>
    );
  }
);

CarNumberCell.displayName = 'CarNumberCell';
