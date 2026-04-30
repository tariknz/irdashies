import { memo } from 'react';

interface FastestTimeCellProps {
  fastestTimeString: string;
  hasFastestTime: boolean;
  compactMode?: string;
}

export const FastestTimeCell = memo(
  ({
    fastestTimeString,
    hasFastestTime,
    compactMode,
  }: FastestTimeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="fastestTime"
        className={`w-auto ${pxClass} whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''}`}
      >
        {fastestTimeString}
      </td>
    );
  }
);

FastestTimeCell.displayName = 'FastestTimeCell';
