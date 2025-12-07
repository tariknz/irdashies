import { memo } from 'react';
import type { LastTimeState } from '../../../createStandings';

interface LastTimeCellProps {
  hidden?: boolean;
  lastTimeString: string;
  lastTimeState?: LastTimeState;
}

const getLastTimeColorClass = (state?: LastTimeState): string => {
  if (state === 'session-fastest') return 'text-purple-400';
  if (state === 'personal-best') return 'text-green-400';
  return '';
};

export const LastTimeCell = memo(({ hidden, lastTimeString, lastTimeState }: LastTimeCellProps) => (
  <td data-column="lastTime" className={`w-auto px-2 whitespace-nowrap ${getLastTimeColorClass(lastTimeState)}`}>
    {hidden ? '' : lastTimeString}
  </td>
));

LastTimeCell.displayName = 'LastTimeCell';

