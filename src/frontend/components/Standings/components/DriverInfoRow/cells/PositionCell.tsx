import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';

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
    const compactMode = useGeneralSettings()?.compactMode;
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    const positionColor = offTrack
      ? 'bg-yellow-400'
      : isPlayer && showBackground
        ? tailwindStyles.classHeader
        : '';
    const textColor = offTrack ? 'text-yellow-900' : 'text-white';

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
