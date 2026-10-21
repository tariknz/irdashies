import { memo, useMemo } from 'react';
import {
  IncidentType,
  resolveSessionFilter,
  type IncidentSessionFilter,
} from '@irdashies/types';
import {
  useRaceControlStore,
  useFilteredIncidents,
  useSessionList,
  useTrackStateSelector,
} from '@irdashies/context';
import {
  buildDriverFilterOptions,
  buildIncidentFeedRows,
  buildSessionFilterOptions,
  type IncidentSessionInfo,
} from '@irdashies/domain';
import type { TrackStateSnapshot } from '@irdashies/types';
import { IncidentRow } from './IncidentRow';
import { SessionSeparatorRow } from './SessionSeparatorRow';
import { Tooltip } from '../Tooltip/Tooltip';

const SETTINGS_HINT =
  'Thresholds live in Settings > Gantry > Incident Detection.';

const FILTERS_COMBINE_HINT =
  'Combines with the session and driver filters below.';

const NO_SESSIONS: readonly IncidentSessionInfo[] = [];

const selectIsReplayPlaying = (snapshot: TrackStateSnapshot) =>
  snapshot.isReplayPlaying;

const selectSessionNum = (snapshot: TrackStateSnapshot) => snapshot.sessionNum;

const parseSessionFilter = (value: string): IncidentSessionFilter =>
  value === 'all' || value === 'current' ? value : Number(value);

const CHIP_STYLES: Record<
  IncidentType,
  { label: string; active: string; inactive: string; description: string }
> = {
  [IncidentType.Crash]: {
    label: 'Crash',
    active: 'bg-red-500/30 text-red-400 border-red-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
    description: `Raised when a car stops suddenly from speed, crawls for several seconds during a race, or goes off alongside another car. ${SETTINGS_HINT}`,
  },
  [IncidentType.OffTrack]: {
    label: 'Off Track',
    active: 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
    description: `Raised when a car leaves the racing surface on its own for longer than the debounce window. ${SETTINGS_HINT}`,
  },
  [IncidentType.Slowdown]: {
    label: 'Slowdown',
    active: 'bg-orange-500/30 text-orange-400 border-orange-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
    description:
      'Raised when iRacing waves the furled black flag at a car, which is normally a track-limits slowdown penalty.',
  },
  [IncidentType.PitEntry]: {
    label: 'Pit Entry',
    active: 'bg-blue-500/30 text-blue-400 border-blue-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
    description: `Raised once a car has stayed on pit road long enough to count as a real stop rather than a brush past the entry. ${SETTINGS_HINT}`,
  },
  [IncidentType.BlackFlag]: {
    label: 'Black Flag',
    active: 'bg-white/15 text-slate-300 border-slate-500',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
    description:
      'Raised the moment race control shows a car the black flag or disqualifies it.',
  },
};

const CHIP_ORDER: IncidentType[] = [
  IncidentType.Crash,
  IncidentType.OffTrack,
  IncidentType.Slowdown,
  IncidentType.PitEntry,
  IncidentType.BlackFlag,
];

export const GantryIncidents = memo(() => {
  const activeTypeFilters = useRaceControlStore((s) => s.activeTypeFilters);
  const toggleTypeFilter = useRaceControlStore((s) => s.toggleTypeFilter);
  const driverFilter = useRaceControlStore((s) => s.driverFilter);
  const setDriverFilter = useRaceControlStore((s) => s.setDriverFilter);
  const sessionFilter = useRaceControlStore((s) => s.sessionFilter);
  const setSessionFilter = useRaceControlStore((s) => s.setSessionFilter);
  const allIncidents = useRaceControlStore((s) => s.incidents);
  const isReplayPlaying = Boolean(useTrackStateSelector(selectIsReplayPlaying));
  const currentSessionNum = useTrackStateSelector(selectSessionNum) ?? null;
  const sessions = useSessionList() ?? NO_SESSIONS;
  const incidents = useFilteredIncidents(currentSessionNum);

  const selectedSessionNum = resolveSessionFilter(
    sessionFilter,
    currentSessionNum
  );

  const rows = useMemo(
    () =>
      buildIncidentFeedRows(
        incidents,
        sessions,
        // A past session picked on its own has no live group to show.
        selectedSessionNum === null || selectedSessionNum === currentSessionNum
          ? currentSessionNum
          : null
      ),
    [incidents, sessions, selectedSessionNum, currentSessionNum]
  );

  const pickedSessionNum =
    typeof sessionFilter === 'number' ? sessionFilter : null;
  const sessionOptions = useMemo(
    () => buildSessionFilterOptions(allIncidents, sessions, pickedSessionNum),
    [allIncidents, sessions, pickedSessionNum]
  );

  const driverOptions = useMemo(
    () =>
      buildDriverFilterOptions(allIncidents, selectedSessionNum, driverFilter),
    [allIncidents, selectedSessionNum, driverFilter]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-slate-700/50 flex-shrink-0">
        {CHIP_ORDER.map((type) => {
          const style = CHIP_STYLES[type];
          const isActive = activeTypeFilters.has(type);
          return (
            <Tooltip
              key={type}
              placement="bottom"
              content={`${style.description} Click to ${isActive ? 'hide' : 'show'} them in the feed. ${FILTERS_COMBINE_HINT}`}
            >
              <button
                aria-pressed={isActive}
                onClick={() => toggleTypeFilter(type)}
                className={[
                  'px-2 py-0.5 rounded text-xs font-bold border cursor-pointer',
                  isActive ? style.active : style.inactive,
                ].join(' ')}
              >
                {style.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Session and driver filter dropdowns */}
      <div className="flex gap-2 px-2 py-1.5 border-b border-slate-700/50 flex-shrink-0">
        <Tooltip
          placement="bottom"
          content="Narrows the feed to one session. Current session follows the live session, or the session of the replay. Combines with the type and driver filters."
        >
          <select
            aria-label="Filter incidents by session"
            value={String(sessionFilter)}
            onChange={(e) =>
              setSessionFilter(parseSessionFilter(e.target.value))
            }
            className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1"
          >
            <option value="all">All sessions</option>
            <option value="current">Current session</option>
            {sessionOptions.map(({ sessionNum, label, count }) => (
              <option key={sessionNum} value={sessionNum}>
                {label} ({count})
              </option>
            ))}
          </select>
        </Tooltip>
        <Tooltip
          placement="bottom"
          content="Narrows the feed to a single driver. Only drivers who have already triggered an incident in the selected session are listed. Combines with the type and session filters."
        >
          <select
            aria-label="Filter incidents by driver"
            value={driverFilter ?? ''}
            onChange={(e) =>
              setDriverFilter(
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1"
          >
            <option value="">All Drivers</option>
            {driverOptions.map(({ carIdx, driverName }) => (
              <option key={carIdx} value={carIdx}>
                {driverName}
              </option>
            ))}
          </select>
        </Tooltip>
      </div>

      {/* Incident feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            No incidents
          </div>
        ) : (
          rows.map((row) =>
            row.kind === 'session' ? (
              <SessionSeparatorRow
                key={`session-${row.sessionNum}`}
                label={row.label}
                count={row.count}
                isCurrent={row.isCurrent}
                isReplay={isReplayPlaying}
              />
            ) : (
              <IncidentRow
                key={row.incident.id}
                incident={row.incident}
                isOdd={row.isOdd}
                isReplayPlaying={isReplayPlaying}
              />
            )
          )
        )}
      </div>
    </div>
  );
});
GantryIncidents.displayName = 'GantryIncidents';
