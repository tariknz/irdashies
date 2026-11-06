import { memo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import type { PitStopRow, PitTeamSummary } from '@irdashies/domain';
import { PitStopLog, type PitStopReplay } from './PitStopLog';
import { formatSigned, formatStopSeconds } from './pitStopFormat';

interface PitTeamTableProps {
  summaries: readonly PitTeamSummary[];
  rows: readonly PitStopRow[];
  followedCarIdx: number | null;
  receivedAt: number;
  showClass: boolean;
  replay: PitStopReplay;
}

const HEADER =
  'sticky top-0 bg-slate-900 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1';

const Delta = ({
  value,
  format,
}: {
  value: number | null;
  format: (value: number) => string;
}) =>
  value === null ? null : (
    <span
      className={[
        'ml-1 text-[11px]',
        value > 0
          ? 'text-red-400'
          : value < 0
            ? 'text-green-400'
            : 'text-slate-500',
      ].join(' ')}
    >
      ({format(value)})
    </span>
  );

const byPosition = (a: PitTeamSummary, b: PitTeamSummary) =>
  (a.car?.classPosition || 999) - (b.car?.classPosition || 999) ||
  a.carIdx - b.carIdx;

/** One row per team: stops, time in the pits and stint length, against yours. */
export const PitTeamTable = memo(
  ({
    summaries,
    rows,
    followedCarIdx,
    receivedAt,
    showClass,
    replay,
  }: PitTeamTableProps) => {
    const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
    const toggle = (carIdx: number) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(carIdx)) next.delete(carIdx);
        else next.add(carIdx);
        return next;
      });

    if (summaries.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          No pit stops yet.
        </div>
      );
    }

    const columns = showClass ? 12 : 11;
    return (
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className={HEADER} />
            <th className={HEADER}>Pos</th>
            <th className={HEADER}>Car</th>
            {showClass && <th className={HEADER}>Class</th>}
            <th className={HEADER}>Team</th>
            <th className={HEADER}>Stops</th>
            <th className={HEADER}>Pit lane total</th>
            <th className={HEADER}>Avg stopped</th>
            <th className={HEADER}>Avg stint</th>
            <th className={HEADER}>Last stop</th>
            <th className={HEADER}>Next stop</th>
            <th className={HEADER}>Drivers</th>
          </tr>
        </thead>
        <tbody>
          {[...summaries].sort(byPosition).map((summary) => {
            const { car } = summary;
            const open = expanded.has(summary.carIdx);
            return [
              <tr
                key={summary.carIdx}
                onClick={() => toggle(summary.carIdx)}
                className={[
                  'cursor-pointer odd:bg-slate-800/40 border-b border-slate-800/60 hover:bg-slate-700/40',
                  car?.isPlayer ? 'text-amber-300' : 'text-slate-200',
                  summary.carIdx === followedCarIdx
                    ? 'outline outline-1 outline-amber-400/70'
                    : '',
                ].join(' ')}
              >
                <td className="px-2 py-1 text-slate-500">
                  {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {car?.classPosition ? `P${car.classPosition}` : '-'}
                </td>
                <td className="px-2 py-1 tabular-nums font-bold">
                  {car ? `#${car.carNumber}` : `car ${summary.carIdx}`}
                </td>
                {showClass && (
                  <td className="px-2 py-1 text-slate-400">
                    {car?.className ?? ''}
                  </td>
                )}
                <td className="px-2 py-1 max-w-56 truncate">
                  {car?.teamName ?? ''}
                  {summary.inPitLane && (
                    <span className="ml-2 rounded bg-amber-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-slate-900">
                      In pits
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {summary.stops}
                  <Delta
                    value={summary.stopsDelta}
                    format={(value) => formatSigned(value)}
                  />
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {formatStopSeconds(summary.pitLaneSeconds)}
                  <Delta
                    value={summary.pitLaneDelta}
                    format={(value) => `${formatSigned(value, 1)}s`}
                  />
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {formatStopSeconds(summary.averageStallSeconds)}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {summary.averageStintLaps === null
                    ? '-'
                    : `${summary.averageStintLaps.toFixed(1)} laps`}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {summary.lastStopLap === null
                    ? '-'
                    : `Lap ${summary.lastStopLap}`}
                  {summary.lapsSinceStop !== null && (
                    <span className="ml-1 text-[11px] text-slate-500">
                      ({summary.lapsSinceStop} ago)
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {summary.nextStopLap === null
                    ? '-'
                    : `≈ Lap ${summary.nextStopLap}`}
                </td>
                <td className="px-2 py-1 max-w-48">
                  <div className="truncate">
                    {summary.drivers.join(', ') || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {summary.driverChanges} change
                    {summary.driverChanges === 1 ? '' : 's'}
                  </div>
                </td>
              </tr>,
              open ? (
                <tr key={`${summary.carIdx}-stops`}>
                  <td colSpan={columns} className="bg-slate-950/60 px-4 py-2">
                    <PitStopLog
                      rows={rows.filter(
                        (row) => row.stop.carIdx === summary.carIdx
                      )}
                      followedCarIdx={null}
                      receivedAt={receivedAt}
                      showClass={false}
                      replay={replay}
                    />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    );
  }
);
PitTeamTable.displayName = 'PitTeamTable';
