import { memo, useMemo } from 'react';
import { IncidentType } from '@irdashies/types';
import {
  useRaceControlStore,
  useFilteredIncidents,
  useTrackStateSelector,
} from '@irdashies/context';
import type { TrackStateSnapshot } from '@irdashies/types';
import { IncidentRow } from './IncidentRow';
import { Tooltip } from '../Tooltip/Tooltip';

const SETTINGS_HINT =
  'Thresholds live in Settings > Gantry > Incident Detection.';

const selectIsReplayPlaying = (snapshot: TrackStateSnapshot) =>
  snapshot.isReplayPlaying;

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
  const allIncidents = useRaceControlStore((s) => s.incidents);
  const incidents = useFilteredIncidents();
  const isReplayPlaying = Boolean(useTrackStateSelector(selectIsReplayPlaying));

  const uniqueDrivers = useMemo(() => {
    const seen = new Map<number, string>();
    for (const i of allIncidents) {
      if (!seen.has(i.carIdx)) {
        seen.set(i.carIdx, i.driverName);
      }
    }
    return [...seen.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([carIdx, driverName]) => ({ carIdx, driverName }));
  }, [allIncidents]);

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
              content={`${style.description} Click to ${isActive ? 'hide' : 'show'} them in the feed.`}
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

      {/* Driver filter dropdown */}
      <div className="px-2 py-1.5 border-b border-slate-700/50 flex-shrink-0">
        <Tooltip
          placement="bottom"
          content="Narrows the feed to a single driver. Only drivers who have already triggered an incident this session are listed."
        >
          <select
            aria-label="Filter incidents by driver"
            value={driverFilter ?? ''}
            onChange={(e) =>
              setDriverFilter(
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1"
          >
            <option value="">All Drivers</option>
            {uniqueDrivers.map(({ carIdx, driverName }) => (
              <option key={carIdx} value={carIdx}>
                {driverName}
              </option>
            ))}
          </select>
        </Tooltip>
      </div>

      {/* Incident feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {incidents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            No incidents
          </div>
        ) : (
          incidents.map((incident, idx) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              isOdd={idx % 2 !== 0}
              isReplayPlaying={isReplayPlaying}
            />
          ))
        )}
      </div>
    </div>
  );
});
GantryIncidents.displayName = 'GantryIncidents';
