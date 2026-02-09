import { memo } from 'react';
import type { LastTimeState } from '../../../createStandings';

interface LastTimeCellProps {
  lastTimeString: string;
  lastTimeState?: LastTimeState;
}

const getLastTimeColorClass = (state?: LastTimeState): string => {
  if (state === 'session-fastest') return 'text-purple-400';
  if (state === 'personal-best') return 'text-green-400';
  return '';
};

export const LastTimeCell = memo(({ lastTimeString, lastTimeState }: LastTimeCellProps) => (
  <td data-column="lastTime" className={`w-auto px-2 whitespace-nowrap ${getLastTimeColorClass(lastTimeState)}`}>
    {lastTimeString}
  </td>
));

LastTimeCell.displayName = 'LastTimeCell';

