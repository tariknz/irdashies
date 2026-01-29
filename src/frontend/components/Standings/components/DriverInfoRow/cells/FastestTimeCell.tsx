import { memo } from 'react';

interface FastestTimeCellProps {
  fastestTimeString: string;
  hasFastestTime: boolean;
}

export const FastestTimeCell = memo(({ fastestTimeString, hasFastestTime }: FastestTimeCellProps) => (
  <td data-column="fastestTime" className={`w-auto px-2 whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''}`}>
    {fastestTimeString}
  </td>
));

FastestTimeCell.displayName = 'FastestTimeCell';

