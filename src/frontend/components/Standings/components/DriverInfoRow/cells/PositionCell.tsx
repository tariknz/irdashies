import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
}

interface PositionCellProps {
  hidden?: boolean;
  position?: number;
  isPlayer: boolean;
  tailwindStyles: TailwindStyles;
}

export const PositionCell = memo(({ hidden, position, isPlayer, tailwindStyles }: PositionCellProps) => (
  <td
    data-column="position"
    className={`w-auto text-center text-white px-2 whitespace-nowrap ${isPlayer ? tailwindStyles.classHeader : ''}`}
  >
    {hidden ? '' : position}
  </td>
));

PositionCell.displayName = 'PositionCell';

