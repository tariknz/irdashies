import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
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

export const LastTimeCell = memo(
  ({ lastTimeString, lastTimeState }: LastTimeCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="lastTime"
        className={`w-auto ${pxClass} whitespace-nowrap ${getLastTimeColorClass(lastTimeState)}`}
      >
        {lastTimeString}
      </td>
    );
  }
);

LastTimeCell.displayName = 'LastTimeCell';
