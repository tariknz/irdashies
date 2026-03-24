import { memo, useMemo } from 'react';
import { IncidentType } from '@irdashies/types';
import {
  useRaceControlStore,
  useFilteredIncidents,
  useTelemetryValue,
} from '@irdashies/context';
import { IncidentRow } from './IncidentRow';

const CHIP_STYLES: Record<
  IncidentType,
  { label: string; active: string; inactive: string }
> = {
  [IncidentType.Crash]: {
    label: 'Crash',
    active: 'bg-red-500/30 text-red-400 border-red-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
  },
  [IncidentType.OffTrack]: {
    label: 'Off Track',
    active: 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
  },
  [IncidentType.Slowdown]: {
    label: 'Slowdown',
    active: 'bg-orange-500/30 text-orange-400 border-orange-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
  },
  [IncidentType.PitEntry]: {
    label: 'Pit Entry',
    active: 'bg-blue-500/30 text-blue-400 border-blue-500/50',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
  },
  [IncidentType.BlackFlag]: {
    label: 'Black Flag',
    active: 'bg-white/15 text-slate-300 border-slate-500',
    inactive: 'bg-slate-800/50 text-slate-600 border-slate-700',
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
  const isReplayPlaying = Boolean(
    useTelemetryValue<boolean>('IsReplayPlaying')
  );

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
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={[
                'px-2 py-0.5 rounded text-xs font-bold border cursor-pointer',
                isActive ? style.active : style.inactive,
              ].join(' ')}
            >
              {style.label}
            </button>
          );
        })}
      </div>

      {/* Driver filter dropdown */}
      <div className="px-2 py-1.5 border-b border-slate-700/50 flex-shrink-0">
        <select
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
