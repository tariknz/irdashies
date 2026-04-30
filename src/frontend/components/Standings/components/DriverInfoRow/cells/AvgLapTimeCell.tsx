import { memo } from 'react';
import { formatTime, type TimeFormat } from '@irdashies/utils/time';

interface AvgLapTimeCellProps {
  avgLapTime?: number;
  timeFormat?: TimeFormat;
  compactMode?: string;
}

export const AvgLapTimeCell = memo(
  ({ avgLapTime, timeFormat = 'mixed', compactMode }: AvgLapTimeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const display =
      avgLapTime && avgLapTime > 0 ? formatTime(avgLapTime, timeFormat) : '--';

    return (
      <td
        data-column="avgLapTime"
        className={`w-auto ${pxClass} whitespace-nowrap`}
      >
        {display}
      </td>
    );
  }
);

AvgLapTimeCell.displayName = 'AvgLapTimeCell';
