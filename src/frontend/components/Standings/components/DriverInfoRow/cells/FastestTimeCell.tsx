import { memo } from 'react';

interface FastestTimeCellProps {
  fastestTimeString: string;
  hasFastestTime: boolean;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const FastestTimeCell = memo(
  ({
    fastestTimeString,
    hasFastestTime,
    compactMode,
    inRotationGroup = false,
  }: FastestTimeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = (
      <div
        className={`whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''} ${inRotationGroup ? 'w-full h-full flex items-center justify-center' : ''}`}
      >
        {fastestTimeString}
      </div>
    );

    if (inRotationGroup) return content;

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
