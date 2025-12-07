import { memo } from 'react';

interface FastestTimeCellProps {
  hidden?: boolean;
  fastestTimeString: string;
  hasFastestTime: boolean;
}

export const FastestTimeCell = memo(({ hidden, fastestTimeString, hasFastestTime }: FastestTimeCellProps) => (
  <td data-column="fastestTime" className={`w-auto px-2 whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''}`}>
    {hidden ? '' : fastestTimeString}
  </td>
));

FastestTimeCell.displayName = 'FastestTimeCell';

