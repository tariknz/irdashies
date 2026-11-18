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
  'sticky top-0 z-10 h-[26px] border-y border-slate-700 bg-slate-900 px-2 text-left text-xs font-normal whitespace-nowrap text-slate-400';

const Badge = ({ children, tone }: { children: string; tone: string }) => (
  <span
    className={`inline-block rounded-sm px-2 py-px text-xs font-semibold whitespace-nowrap ${tone}`}
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
          'border-b border-slate-700/55 tabular-nums',
          car?.isPlayer
            ? 'bg-yellow-500/20 text-amber-300 hover:bg-yellow-500/30'
            : 'text-slate-200 hover:bg-slate-800',
          followed ? 'outline-2 -outline-offset-2 outline-accent-400' : '',
        ].join(' ')}
      >
        <td className="px-2 py-1 text-slate-400">
          {formatSessionClock(stop.entryTime)}
        </td>
        <td className="px-2 py-1">{stop.lap}</td>
        <td className="px-2 py-1 font-semibold">
          {car ? `#${car.carNumber}` : `car ${stop.carIdx}`}
        </td>
        {showClass && (
          <td className="px-2 py-1 text-slate-400">{car?.className ?? ''}</td>
        )}
        <td className="px-2 py-1 max-w-56">
          <div className="truncate">{car?.teamName ?? ''}</div>
          <div className="truncate text-xs text-slate-400">
            {row.driverChanged
              ? `${stop.driverNameIn} → ${stop.driverNameOut}`
              : stop.driverNameIn}
          </div>
        </td>
        <td className="px-2 py-1 text-slate-400">{row.number}</td>
        <td className="px-2 py-1">{row.stintLaps || '-'}</td>
        <td className="px-2 py-1">
          <LiveSeconds
            seconds={row.pitLaneSeconds}
            running={row.inProgress}
            since={receivedAt}
          />
        </td>
        <td className="px-2 py-1">
          <LiveSeconds
            seconds={stop.stallTime === null ? null : row.stallSeconds}
            running={stop.stallEnteredAt !== null}
            since={receivedAt}
          />
        </td>
        <td className="px-2 py-1 whitespace-nowrap">
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
              <Badge tone="bg-yellow-500/20 text-yellow-400">In pits</Badge>
            )}
            {row.driverChanged && (
              <Badge tone="bg-blue-500/20 text-blue-400">Driver change</Badge>
            )}
            {stop.fastRepairs > 0 && (
              <Badge tone="bg-red-500/20 text-red-400">Fast repair</Badge>
            )}
            {compoundChanged && (
              <Badge tone="bg-emerald-500/20 text-emerald-400">Compound</Badge>
            )}
            {stop.kind === 'tow' && (
              <Badge tone="bg-orange-500/20 text-orange-400">Towed</Badge>
            )}
            {stop.exitTime !== null && stop.stallTime === null && (
              <Badge tone="bg-white/10 text-slate-300">Drive-through</Badge>
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
                className="settings-button min-h-7 px-2.5 py-0.5 tabular-nums"
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
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No pit stops yet.
        </div>
      );
    }
    return (
      <table className="w-full border-collapse text-sm">
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
