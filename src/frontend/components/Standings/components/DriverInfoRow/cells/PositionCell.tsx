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
  showBackground?: boolean;
}

export const PositionCell = memo(
  ({
    position,
    isPlayer,
    offTrack,
    tailwindStyles,
    showBackground = true,
  }: PositionCellProps) => {
    const positionColor = offTrack
      ? 'bg-yellow-400'
      : isPlayer && showBackground
        ? tailwindStyles.classHeader
        : '';
    const textColor = offTrack ? 'text-yellow-900' : 'text-white';

    return (
      <td
        data-column="position"
        className={`w-auto text-center px-2 whitespace-nowrap ${positionColor} ${textColor}`}
      >
        {position}
      </td>
    );
  }
);

PositionCell.displayName = 'PositionCell';
