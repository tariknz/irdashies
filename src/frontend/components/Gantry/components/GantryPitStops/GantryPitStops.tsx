import { memo, useMemo } from 'react';
import { useTrackStateSelector } from '@irdashies/context';
import { getTailwindStyle } from '@irdashies/utils/colors';
import type { PitStopRow } from '@irdashies/domain';
import type { TrackStateSnapshot } from '@irdashies/types';
import { GantryPanel } from '../GantryPanel/GantryPanel';
import { Tooltip } from '../Tooltip/Tooltip';
import { LiveSeconds } from './LiveSeconds';
import { PitStopLog, type PitStopReplay } from './PitStopLog';
import { PitTeamTable } from './PitTeamTable';
import { usePitStopData, type PitStopData } from './usePitStopData';

export type PitStopsMode = 'stops' | 'teams';
/** A class id, or every class. */
export type PitStopsClassFilter = string | 'all';

export const ALL_CLASSES = 'all';

interface ViewState {
  followedCarIdx: number | null;
  /** null means the player's class. */
  classFilter: PitStopsClassFilter | null;
  onClassFilterChange: (filter: PitStopsClassFilter) => void;
  mode: PitStopsMode;
  onModeChange: (mode: PitStopsMode) => void;
  /** null lists every team. */
  teamFilter: number | null;
  onTeamFilterChange: (carIdx: number | null) => void;
}

const toggleClass = (active: boolean) =>
  [
    'flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
    active
      ? 'border-accent-500 bg-accent-500 text-on-accent'
      : 'border-settings-boundary bg-transparent text-slate-300 hover:border-slate-400',
  ].join(' ');
const LABEL = 'text-sm text-slate-400';

const PANEL_TITLES: Record<PitStopsMode, string> = {
  stops: 'Pit stops',
  teams: 'Team strategy',
};

const MODE_TOOLTIPS: Record<PitStopsMode, string> = {
  stops:
    'Every stop, newest first: when it happened, how long the car spent in the pit lane and stopped, and any driver change.',
  teams:
    'One row per team: how many stops, how long in the pits and how long their stints run, compared with your car. Click a team to see its stops.',
};

const selectIsReplayPlaying = (snapshot: TrackStateSnapshot) =>
  snapshot.isReplayPlaying;

const PitLaneNow = memo(
  ({ rows, receivedAt }: { rows: PitStopRow[]; receivedAt: number }) => {
    if (rows.length === 0) return null;
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 bg-yellow-500/10 px-4 py-2">
        <span className={LABEL}>In pit lane</span>
        {rows.map((row) => (
          <span
            key={row.stop.id}
            className={[
              'flex items-center gap-2 rounded-md border border-settings-boundary bg-settings-control px-2 py-0.5 text-sm tabular-nums',
              row.car?.isPlayer ? 'text-amber-300' : 'text-slate-200',
            ].join(' ')}
          >
            <span className="font-semibold">
              #{row.car?.carNumber ?? row.stop.carIdx}
            </span>
            <span className="text-slate-400">lane</span>
            <LiveSeconds
              seconds={row.pitLaneSeconds}
              running
              since={receivedAt}
            />
            <span className="text-slate-400">stopped</span>
            <LiveSeconds
              seconds={row.stop.stallTime === null ? null : row.stallSeconds}
              running={row.stop.stallEnteredAt !== null}
              since={receivedAt}
            />
          </span>
        ))}
      </div>
    );
  }
);
PitLaneNow.displayName = 'PitLaneNow';

export const PitStopsView = memo(
  ({
    data,
    followedCarIdx,
    classFilter,
    onClassFilterChange,
    mode,
    onModeChange,
    teamFilter,
    onTeamFilterChange,
    isReplayPlaying = false,
  }: ViewState & { data: PitStopData; isReplayPlaying?: boolean }) => {
    const { rows, summaries, classes, receivedAt } = data;
    const replay: PitStopReplay = useMemo(
      () => ({ sessionNum: data.sessionNum, available: isReplayPlaying }),
      [data.sessionNum, isReplayPlaying]
    );
    const activeClass =
      classFilter === ALL_CLASSES ||
      (classFilter !== null && classes.some((c) => c.id === classFilter))
        ? classFilter
        : (data.defaultClassId ?? ALL_CLASSES);
    const isMultiClass = classes.length > 1;
    const classRows = useMemo(
      () =>
        activeClass === ALL_CLASSES
          ? rows
          : rows.filter((row) => String(row.car?.classId) === activeClass),
      [rows, activeClass]
    );
    const classSummaries = useMemo(
      () =>
        activeClass === ALL_CLASSES
          ? summaries
          : summaries.filter(
              (summary) => String(summary.car?.classId) === activeClass
            ),
      [summaries, activeClass]
    );
    const teamOptions = useMemo(
      () =>
        classSummaries
          .filter((summary) => summary.car)
          .sort((a, b) =>
            (a.car?.carNumber ?? '').localeCompare(
              b.car?.carNumber ?? '',
              undefined,
              { numeric: true }
            )
          ),
      [classSummaries]
    );
    const team = teamOptions.some((summary) => summary.carIdx === teamFilter)
      ? teamFilter
      : null;
    const logRows = useMemo(
      () =>
        team === null
          ? classRows
          : classRows.filter((row) => row.stop.carIdx === team),
      [classRows, team]
    );
    const inPitLane = useMemo(
      () => classRows.filter((row) => row.inProgress),
      [classRows]
    );
    const showClass = isMultiClass && activeClass === ALL_CLASSES;

    return (
      <GantryPanel label="Pit stops">
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-700 px-4 py-2.5">
          <h2 className="mr-auto text-lg leading-snug font-semibold text-slate-200">
            {PANEL_TITLES[mode]}
          </h2>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Pit stops view"
          >
            {(['stops', 'teams'] as PitStopsMode[]).map((option) => (
              <Tooltip
                key={option}
                placement="bottom"
                content={MODE_TOOLTIPS[option]}
              >
                <button
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => onModeChange(option)}
                  className={toggleClass(mode === option)}
                >
                  {option === 'stops' ? 'Stops' : 'Teams'}
                </button>
              </Tooltip>
            ))}
          </div>

          {isMultiClass && (
            <div className="flex items-center gap-2">
              <span className={LABEL}>Class</span>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label="Pit stops car class"
              >
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    aria-pressed={cls.id === activeClass}
                    onClick={() => onClassFilterChange(cls.id)}
                    className={toggleClass(cls.id === activeClass)}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: getTailwindStyle(
                          cls.color,
                          undefined,
                          true
                        ).canvasFill,
                      }}
                    />
                    {cls.name}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={activeClass === ALL_CLASSES}
                  onClick={() => onClassFilterChange(ALL_CLASSES)}
                  className={toggleClass(activeClass === ALL_CLASSES)}
                >
                  All
                </button>
              </div>
            </div>
          )}

          {mode === 'stops' && (
            <div className="flex items-center gap-2">
              <span className={LABEL}>Team</span>
              <select
                aria-label="Pit stops team"
                value={team ?? ''}
                onChange={(event) =>
                  onTeamFilterChange(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                className="settings-field max-w-60"
              >
                <option value="">All teams</option>
                {teamOptions.map((summary) => (
                  <option key={summary.carIdx} value={summary.carIdx}>
                    #{summary.car?.carNumber} {summary.car?.teamName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-sm text-slate-400 tabular-nums">
            {logRows.length} stop{logRows.length === 1 ? '' : 's'}
          </span>
        </div>

        <PitLaneNow rows={inPitLane} receivedAt={receivedAt} />

        <div className="flex-1 min-h-0 overflow-auto">
          {mode === 'stops' ? (
            <PitStopLog
              rows={logRows}
              followedCarIdx={followedCarIdx}
              receivedAt={receivedAt}
              showClass={showClass}
              replay={replay}
            />
          ) : (
            <PitTeamTable
              summaries={classSummaries}
              rows={classRows}
              followedCarIdx={followedCarIdx}
              receivedAt={receivedAt}
              showClass={showClass}
              replay={replay}
            />
          )}
        </div>
      </GantryPanel>
    );
  }
);
PitStopsView.displayName = 'PitStopsView';

/** The Gantry's Pit Stops tab. View choices are owned by the Gantry. */
export const GantryPitStops = memo((props: ViewState) => {
  const data = usePitStopData();
  const isReplayPlaying = Boolean(useTrackStateSelector(selectIsReplayPlaying));
  return (
    <PitStopsView {...props} data={data} isReplayPlaying={isReplayPlaying} />
  );
});
GantryPitStops.displayName = 'GantryPitStops';
