import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
}

interface CarNumberCellProps {
  carNumber?: string;
  tailwindStyles: TailwindStyles;
}

export const CarNumberCell = memo(({ carNumber, tailwindStyles }: CarNumberCellProps) => (
  <td
    data-column="carNumber"
    className={`w-auto ${tailwindStyles.driverIcon} border-l-4 text-white text-right px-1 whitespace-nowrap`}
  >
    {`#${carNumber}`}
  </td>
));

CarNumberCell.displayName = 'CarNumberCell';

