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
  compactMode?: string;
}

export const PositionCell = memo(
  ({
    position,
    isPlayer,
    offTrack,
    tailwindStyles,
    compactMode,
  }: PositionCellProps) => {
    const positionColor = offTrack
      ? 'bg-yellow-400'
      : isPlayer
        ? tailwindStyles.classHeader
        : '';
    const textColor = offTrack ? 'text-yellow-900' : 'text-white';
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    return (
      <td
        data-column="position"
        className={`w-auto text-center ${pxClass} whitespace-nowrap ${positionColor} ${textColor}`}
      >
        {position}
      </td>
    );
  }
);

PositionCell.displayName = 'PositionCell';
