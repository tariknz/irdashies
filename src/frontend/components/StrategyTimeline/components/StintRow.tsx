import { memo } from 'react';
import { ArrowsClockwiseIcon, WarningIcon } from '@phosphor-icons/react';
import type { RacePlanClashLevel } from '@irdashies/domain';
import type { RacePlanStintStatus } from '@irdashies/types';

const STATUS_LABEL: Record<RacePlanStintStatus, string> = {
  done: 'Done',
  current: 'In car',
  upcoming: 'Upcoming',
  unassigned: 'Unassigned',
  dropped: 'Dropped',
};

const STATUS_CHIP: Record<RacePlanStintStatus, string> = {
  done: 'bg-slate-700 text-slate-300',
  current: 'bg-sky-600 text-white',
  upcoming: 'bg-slate-700 text-slate-100',
  unassigned: 'bg-amber-500/30 text-amber-200',
  dropped: 'bg-red-900/60 text-red-200',
};

const rowClass = (status: RacePlanStintStatus, mine: boolean) =>
  [
    'odd:bg-slate-800/40',
    status === 'current' ? 'bg-sky-900/50! font-semibold' : '',
    status === 'done' ? 'text-white/50' : '',
    status === 'dropped' ? 'text-white/40' : '',
    mine && status !== 'done' && status !== 'dropped' ? 'text-amber-300' : '',
  ].join(' ');

interface StintRowProps {
  number: number;
  driverName: string;
  mine: boolean;
  status: RacePlanStintStatus;
  plannedStart: string | null;
  projectedStart: string;
  rebuilt: boolean;
  clashLevel: RacePlanClashLevel | null;
  clashText: string | null;
}

export const StintRow = memo(
  ({
    number,
    driverName,
    mine,
    status,
    plannedStart,
    projectedStart,
    rebuilt,
    clashLevel,
    clashText,
  }: StintRowProps) => (
    <tr className={rowClass(status, mine)} aria-current={status === 'current'}>
      <td className="px-1 py-0.5 text-right tabular-nums text-slate-400">
        {number}
      </td>
      <td className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center gap-1">
          <span
            className={[
              'truncate',
              status === 'dropped' ? 'line-through' : '',
              status === 'unassigned' ? 'italic' : '',
            ].join(' ')}
          >
            {driverName}
          </span>
          {rebuilt && (
            <span
              title="Rebuilt after a stop"
              aria-label="Rebuilt after a stop"
              role="img"
              className="flex-none text-sky-300"
            >
              <ArrowsClockwiseIcon size={12} />
            </span>
          )}
          {clashLevel && clashText && (
            <span
              title={clashText}
              aria-label={clashText}
              role="img"
              className={`flex-none ${clashLevel === 'clash' ? 'text-red-400' : 'text-amber-300'}`}
            >
              <WarningIcon size={14} weight="fill" />
            </span>
          )}
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-1 py-0.5 tabular-nums text-slate-400 @sm:table-cell">
        {plannedStart ?? '--'}
      </td>
      <td className="whitespace-nowrap px-1 py-0.5 tabular-nums">
        {projectedStart}
      </td>
      <td className="hidden px-1 py-0.5 @2xs:table-cell">
        <span
          className={`whitespace-nowrap rounded-sm px-1 text-[11px] font-normal ${STATUS_CHIP[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </td>
    </tr>
  )
);
StintRow.displayName = 'StintRow';
