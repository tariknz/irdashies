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
  offTrack: boolean;
}

export const PositionCell = memo(({ hidden, position, isPlayer, offTrack, tailwindStyles }: PositionCellProps) => {

  const positionColor = (offTrack) ? 'bg-yellow-300' : (isPlayer) ? tailwindStyles.classHeader : '';

  return (
    <td
      data-column="position"
      className={`w-auto text-center text-white px-2 whitespace-nowrap ${positionColor}`}
    >
      {hidden ? '' : position}
    </td>
  );
});

PositionCell.displayName = 'PositionCell';

