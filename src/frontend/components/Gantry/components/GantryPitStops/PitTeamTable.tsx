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
  'sticky top-0 z-10 h-[26px] border-y border-slate-700 bg-slate-900 px-2 text-left text-xs font-normal whitespace-nowrap text-slate-400';

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
        'ml-1 text-xs',
        value > 0
          ? 'text-red-400'
          : value < 0
            ? 'text-green-400'
            : 'text-slate-400',
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
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No pit stops yet.
        </div>
      );
    }

    const columns = showClass ? 12 : 11;
    return (
      <table className="w-full border-collapse text-sm">
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
                  'cursor-pointer border-b border-slate-700/55 tabular-nums',
                  car?.isPlayer
                    ? 'bg-yellow-500/20 text-amber-300 hover:bg-yellow-500/30'
                    : 'text-slate-200 hover:bg-slate-800',
                  summary.carIdx === followedCarIdx
                    ? 'outline-2 -outline-offset-2 outline-accent-400'
                    : '',
                ].join(' ')}
              >
                <td className="px-2 py-1 text-slate-400">
                  {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                </td>
                <td className="px-2 py-1">
                  {car?.classPosition ? `P${car.classPosition}` : '-'}
                </td>
                <td className="px-2 py-1 font-semibold">
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
                    <span className="ml-2 rounded-sm bg-yellow-500/20 px-2 py-px text-xs font-semibold text-yellow-400">
                      In pits
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {summary.stops}
                  <Delta
                    value={summary.stopsDelta}
                    format={(value) => formatSigned(value)}
                  />
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {formatStopSeconds(summary.pitLaneSeconds)}
                  <Delta
                    value={summary.pitLaneDelta}
                    format={(value) => `${formatSigned(value, 1)}s`}
                  />
                </td>
                <td className="px-2 py-1">
                  {formatStopSeconds(summary.averageStallSeconds)}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {summary.averageStintLaps === null
                    ? '-'
                    : `${summary.averageStintLaps.toFixed(1)} laps`}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {summary.lastStopLap === null
                    ? '-'
                    : `Lap ${summary.lastStopLap}`}
                  {summary.lapsSinceStop !== null && (
                    <span className="ml-1 text-xs text-slate-400">
                      ({summary.lapsSinceStop} ago)
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {summary.nextStopLap === null
                    ? '-'
                    : `≈ Lap ${summary.nextStopLap}`}
                </td>
                <td className="px-2 py-1 max-w-48">
                  <div className="truncate">
                    {summary.drivers.join(', ') || '-'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {summary.driverChanges} change
                    {summary.driverChanges === 1 ? '' : 's'}
                  </div>
                </td>
              </tr>,
              open ? (
                <tr key={`${summary.carIdx}-stops`}>
                  <td
                    colSpan={columns}
                    className="border-b border-slate-700 bg-slate-950/60 px-4 py-2"
                  >
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
