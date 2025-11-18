import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
}

interface CarNumberCellProps {
  hidden?: boolean;
  carNumber?: string;
  tailwindStyles: TailwindStyles;
}

export const CarNumberCell = memo(({ hidden, carNumber, tailwindStyles }: CarNumberCellProps) => (
  <td
    data-column="carNumber"
    className={`w-auto ${tailwindStyles.driverIcon} border-l-4 text-white text-right px-1 whitespace-nowrap`}
  >
    {hidden ? '' : `#${carNumber}`}
  </td>
));

CarNumberCell.displayName = 'CarNumberCell';

