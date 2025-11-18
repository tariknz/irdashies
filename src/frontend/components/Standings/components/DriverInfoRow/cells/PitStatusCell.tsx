import { memo } from 'react';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
}

export const PitStatusCell = memo(({ hidden, onPitRoad }: PitStatusCellProps) => (
  <td data-column="pitStatus" className="w-auto px-1 text-center">
    {hidden ? null : (onPitRoad && (
      <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 leading-tight">
        PIT
      </span>
    ))}
  </td>
));

PitStatusCell.displayName = 'PitStatusCell';

