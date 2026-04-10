import { memo } from 'react';
import type { LastTimeState } from '../../../createStandings';

interface LastTimeCellProps {
  lastTimeString: string;
  lastTimeState?: LastTimeState;
  compactMode?: string;
  inRotationGroup?: boolean;
}

const getLastTimeColorClass = (state?: LastTimeState): string => {
  if (state === 'session-fastest') return 'text-purple-400';
  if (state === 'personal-best') return 'text-green-400';
  return '';
};

export const LastTimeCell = memo(
  ({
    lastTimeString,
    lastTimeState,
    compactMode,
    inRotationGroup = false,
  }: LastTimeCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = (
      <div
        className={`whitespace-nowrap ${getLastTimeColorClass(lastTimeState)} ${inRotationGroup ? 'w-full h-full flex items-center justify-center' : ''}`}
      >
        {lastTimeString}
      </div>
    );

    if (inRotationGroup) return content;

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
