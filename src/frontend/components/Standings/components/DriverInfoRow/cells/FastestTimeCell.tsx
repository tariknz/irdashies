import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';

interface FastestTimeCellProps {
  fastestTimeString: string;
  hasFastestTime: boolean;
}

export const FastestTimeCell = memo(
  ({ fastestTimeString, hasFastestTime }: FastestTimeCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
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
