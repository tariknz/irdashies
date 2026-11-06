import { memo } from 'react';
import type { PitStopRow } from '@irdashies/domain';
import logger from '@irdashies/utils/logger';
import { Tooltip } from '../Tooltip/Tooltip';
import { LiveSeconds } from './LiveSeconds';
import { formatSessionClock, formatSigned } from './pitStopFormat';

export interface PitStopReplay {
  /** The session the stops were recorded in. */
  sessionNum: number | null;
  /** A replay is playing, so there is a position to jump to. */
  available: boolean;
}

interface PitStopLogProps {
  rows: readonly PitStopRow[];
  followedCarIdx: number | null;
  receivedAt: number;
  /** Show the class column; only useful with more than one class listed. */
  showClass: boolean;
  replay: PitStopReplay;
}

const REPLAY_LEAD_SECONDS = 5;

const HEADER =
  'sticky top-0 bg-slate-900 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1';

const Badge = ({ children, tone }: { children: string; tone: string }) => (
  <span
    className={`inline-block rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider ${tone}`}
  >
    {children}
  </span>
);

const rowSignature = (row: PitStopRow) =>
  [
    row.stop.id,
    row.stop.exitTime,
    row.stop.stallSeconds,
    row.stop.stallEnteredAt,
    row.stop.driverNameOut,
    row.stop.classPositionOut,
    row.car?.carNumber,
    row.car?.teamName,
    row.car?.isPlayer,
  ].join('|');

interface LogRowProps {
  row: PitStopRow;
  followed: boolean;
  receivedAt: number;
  showClass: boolean;
  replay: PitStopReplay;
}

const LogRow = memo(
  ({ row, followed, receivedAt, showClass, replay }: LogRowProps) => {
    const { stop, car } = row;
    const compoundChanged = stop.compoundOut !== stop.compoundIn;
    const sessionNum = replay.sessionNum;
    const canReplay = replay.available && sessionNum !== null && !!car;
    const handleReplay = () => {
      if (!car || sessionNum === null) return;
      window.raceControlBridge
        ?.replayPitStop(
          {
            sessionNum,
            sessionTime: stop.stallTime ?? stop.entryTime,
            carNumber: car.carNumber,
            carIdx: stop.carIdx,
            driverName: stop.driverNameIn,
          },
          REPLAY_LEAD_SECONDS
        )
        .catch((err) => logger.warn('[Gantry] replayPitStop failed:', err));
    };
    return (
      <tr
        className={[
          'odd:bg-slate-800/40 border-b border-slate-800/60',
          car?.isPlayer ? 'text-amber-300' : 'text-slate-200',
          followed ? 'outline outline-1 outline-amber-400/70' : '',
        ].join(' ')}
      >
        <td className="px-2 py-1 tabular-nums text-slate-400">
          {formatSessionClock(stop.entryTime)}
        </td>
        <td className="px-2 py-1 tabular-nums">{stop.lap}</td>
        <td className="px-2 py-1 tabular-nums font-bold">
          {car ? `#${car.carNumber}` : `car ${stop.carIdx}`}
        </td>
        {showClass && (
          <td className="px-2 py-1 text-slate-400">{car?.className ?? ''}</td>
        )}
        <td className="px-2 py-1 max-w-56">
          <div className="truncate">{car?.teamName ?? ''}</div>
          <div className="truncate text-[11px] text-slate-400">
            {row.driverChanged
              ? `${stop.driverNameIn} → ${stop.driverNameOut}`
              : stop.driverNameIn}
          </div>
        </td>
        <td className="px-2 py-1 tabular-nums text-slate-400">{row.number}</td>
        <td className="px-2 py-1 tabular-nums">{row.stintLaps || '-'}</td>
        <td className="px-2 py-1 tabular-nums">
          <LiveSeconds
            seconds={row.pitLaneSeconds}
            running={row.inProgress}
            since={receivedAt}
          />
        </td>
        <td className="px-2 py-1 tabular-nums">
          <LiveSeconds
            seconds={stop.stallTime === null ? null : row.stallSeconds}
            running={stop.stallEnteredAt !== null}
            since={receivedAt}
          />
        </td>
        <td className="px-2 py-1 tabular-nums">
          {row.positionChange === null ? (
            '-'
          ) : (
            <span
              className={
                row.positionChange > 0
                  ? 'text-green-400'
                  : row.positionChange < 0
                    ? 'text-red-400'
                    : 'text-slate-400'
              }
            >
              P{stop.classPositionOut} ({formatSigned(row.positionChange)})
            </span>
          )}
        </td>
        <td className="px-2 py-1">
          <div className="flex flex-wrap gap-1">
            {row.inProgress && (
              <Badge tone="bg-amber-500 text-slate-900">In pits</Badge>
            )}
            {row.driverChanged && (
              <Badge tone="bg-sky-700 text-sky-100">Driver change</Badge>
            )}
            {stop.fastRepairs > 0 && (
              <Badge tone="bg-red-800 text-red-100">Fast repair</Badge>
            )}
            {compoundChanged && (
              <Badge tone="bg-emerald-800 text-emerald-100">Compound</Badge>
            )}
            {stop.kind === 'tow' && (
              <Badge tone="bg-slate-600 text-slate-100">Towed</Badge>
            )}
            {stop.exitTime !== null && stop.stallTime === null && (
              <Badge tone="bg-slate-700 text-slate-200">Drive-through</Badge>
            )}
          </div>
        </td>
        <td className="px-2 py-1 text-right">
          {/* Disabled buttons emit no mouse events, so the span carries them. */}
          <Tooltip
            placement="bottom"
            content={
              canReplay
                ? `Jumps the sim's replay to ${REPLAY_LEAD_SECONDS} seconds before #${car?.carNumber} reached its pit box, on the Far Chase camera.`
                : 'Only works while a replay is playing. The sim is running live, so there is no replay position to jump to.'
            }
          >
            <span className="inline-flex">
              <button
                type="button"
                onClick={handleReplay}
                disabled={!canReplay}
                className={[
                  'px-2 py-0.5 rounded text-xs font-bold',
                  canReplay
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
                    : 'bg-white/5 text-slate-600 border border-slate-700 cursor-not-allowed',
                ].join(' ')}
              >
                -{REPLAY_LEAD_SECONDS}s
              </button>
            </span>
          </Tooltip>
        </td>
      </tr>
    );
  },
  (previous, next) =>
    previous.followed === next.followed &&
    previous.showClass === next.showClass &&
    previous.receivedAt === next.receivedAt &&
    previous.replay.available === next.replay.available &&
    previous.replay.sessionNum === next.replay.sessionNum &&
    rowSignature(previous.row) === rowSignature(next.row)
);
LogRow.displayName = 'PitStopLogRow';

/** Every stop, newest first. */
export const PitStopLog = memo(
  ({
    rows,
    followedCarIdx,
    receivedAt,
    showClass,
    replay,
  }: PitStopLogProps) => {
    if (rows.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          No pit stops yet.
        </div>
      );
    }
    return (
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className={HEADER}>Time</th>
            <th className={HEADER}>Lap</th>
            <th className={HEADER}>Car</th>
            {showClass && <th className={HEADER}>Class</th>}
            <th className={HEADER}>Team / Driver</th>
            <th className={HEADER}>Stop</th>
            <th className={HEADER}>Stint</th>
            <th className={HEADER}>Pit lane</th>
            <th className={HEADER}>Stopped</th>
            <th className={HEADER}>Class pos</th>
            <th className={HEADER} />
            <th className={HEADER} />
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => (
            <LogRow
              key={row.stop.id}
              row={row}
              followed={row.stop.carIdx === followedCarIdx}
              receivedAt={row.inProgress ? receivedAt : 0}
              showClass={showClass}
              replay={replay}
            />
          ))}
        </tbody>
      </table>
    );
  }
);
PitStopLog.displayName = 'PitStopLog';
