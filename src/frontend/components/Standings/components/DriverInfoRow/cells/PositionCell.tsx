import { memo } from 'react';

interface TailwindStyles {
  classHeader: string;
  driverIcon: string;
}

interface PositionCellProps {
  position?: number;
  isPlayer: boolean;
  tailwindStyles: TailwindStyles;
  offTrack: boolean;
}

export const PositionCell = memo(({ position, isPlayer, offTrack, tailwindStyles }: PositionCellProps) => {
  const positionColor = (offTrack) ? 'bg-yellow-400' : (isPlayer) ? tailwindStyles.classHeader : '';
  const textColor = (offTrack) ? 'text-yellow-900' : 'text-white';

  return (
    <td
      data-column="position"
      className={`w-auto text-center px-2 whitespace-nowrap ${positionColor} ${textColor}`}
    >
      {position}
    </td>
  );
});

PositionCell.displayName = 'PositionCell';

