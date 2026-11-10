import { t } from '@irdashies/frontend/i18n';
import { memo, useId, useMemo } from 'react';
import { Check } from '@phosphor-icons/react';
import {
  IncidentType,
  resolveSessionFilter,
  type IncidentSessionFilter,
} from '@irdashies/types';
import {
  useRaceControlStore,
  useFilteredIncidents,
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
import { GantryPanel } from '../GantryPanel/GantryPanel';
import { Tooltip } from '../Tooltip/Tooltip';
import { useGantrySessionData } from '../../hooks/useGantrySessionData';

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
  { label: string; dotOn: string; dotOff: string; description: string }
> = {
  [IncidentType.Crash]: {
    label: 'Crash',
    dotOn: 'border-red-400 bg-red-400',
    dotOff: 'border-red-400',
    description: `Raised when a car stops suddenly from speed, crawls for several seconds during a race, or goes off alongside another car. ${SETTINGS_HINT}`,
  },
  [IncidentType.OffTrack]: {
    label: 'Off Track',
    dotOn: 'border-yellow-400 bg-yellow-400',
    dotOff: 'border-yellow-400',
    description: `Raised when a car leaves the racing surface on its own for longer than the debounce window. ${SETTINGS_HINT}`,
  },
  [IncidentType.Slowdown]: {
    label: 'Slowdown',
    dotOn: 'border-orange-400 bg-orange-400',
    dotOff: 'border-orange-400',
    description:
      'Raised when iRacing waves the furled black flag at a car, which is normally a track-limits slowdown penalty.',
  },
  [IncidentType.PitEntry]: {
    label: 'Pit Entry',
    dotOn: 'border-blue-400 bg-blue-400',
    dotOff: 'border-blue-400',
    description: `Raised once a car has stayed on pit road long enough to count as a real stop rather than a brush past the entry. ${SETTINGS_HINT}`,
  },
  [IncidentType.BlackFlag]: {
    label: 'Black Flag',
    dotOn: 'border-slate-300 bg-slate-300',
    dotOff: 'border-slate-300',
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
  const sessions = useGantrySessionData().sessions ?? NO_SESSIONS;
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

  const sessionId = useId();
  const driverId = useId();

  return (
    <GantryPanel
      title={t('Incidents')}
      aside={
        <span className="text-sm text-slate-400 tabular-nums">
          {incidents.length} {t('shown')}
        </span>
      }
    >
      <div
        role="group"
        aria-label={t('Incident types')}
        className="flex flex-shrink-0 flex-wrap gap-1.5 px-4 pb-2"
      >
        {CHIP_ORDER.map((type) => {
          const style = CHIP_STYLES[type];
          const isActive = activeTypeFilters.has(type);
          return (
            <Tooltip
              key={type}
              placement="bottom"
              content={`${t(style.description)} ${isActive ? t('Click to hide them in the feed.') : t('Click to show them in the feed.')} ${t(FILTERS_COMBINE_HINT)}`}
            >
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleTypeFilter(type)}
                className={[
                  'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors',
                  isActive
                    ? 'border-settings-boundary bg-settings-control text-slate-200'
                    : 'border-settings-hover bg-transparent text-slate-400 hover:bg-settings-hover',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'size-2 rounded-full border-[1.5px]',
                    isActive ? style.dotOn : style.dotOff,
                  ].join(' ')}
                />
                {t(style.label)}
                {isActive && (
                  <Check
                    aria-hidden="true"
                    size={12}
                    className="text-slate-300"
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="grid flex-shrink-0 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-slate-700 px-4 pb-3">
        <label htmlFor={sessionId} className="text-sm text-slate-400">
          {t('Session')}
        </label>
        <Tooltip
          placement="bottom"
          content={t(
            'Narrows the feed to one session. Current session follows the live session, or the session of the replay. Combines with the type and driver filters.'
          )}
        >
          <select
            id={sessionId}
            aria-label={t('Filter incidents by session')}
            value={String(sessionFilter)}
            onChange={(e) =>
              setSessionFilter(parseSessionFilter(e.target.value))
            }
            className="settings-field"
          >
            <option value="all">{t('All sessions')}</option>
            <option value="current">{t('Current session')}</option>
            {sessionOptions.map(({ sessionNum, label, count }) => (
              <option key={sessionNum} value={sessionNum}>
                {t(label)} ({count})
              </option>
            ))}
          </select>
        </Tooltip>
        <label htmlFor={driverId} className="text-sm text-slate-400">
          {t('Driver')}
        </label>
        <Tooltip
          placement="bottom"
          content={t(
            'Narrows the feed to a single driver. Only drivers who have already triggered an incident in the selected session are listed. Combines with the type and session filters.'
          )}
        >
          <select
            id={driverId}
            aria-label={t('Filter incidents by driver')}
            value={driverFilter ?? ''}
            onChange={(e) =>
              setDriverFilter(
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className="settings-field"
          >
            <option value="">{t('All Drivers')}</option>
            {driverOptions.map(({ carIdx, driverName }) => (
              <option key={carIdx} value={carIdx}>
                {driverName}
              </option>
            ))}
          </select>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {t('No incidents')}
          </div>
        ) : (
          rows.map((row) =>
            row.kind === 'session' ? (
              <SessionSeparatorRow
                key={`session-${row.sessionNum}`}
                label={t(row.label)}
                count={row.count}
                isCurrent={row.isCurrent}
                isReplay={isReplayPlaying}
              />
            ) : (
              <IncidentRow
                key={row.incident.id}
                incident={row.incident}
                isReplayPlaying={isReplayPlaying}
              />
            )
          )
        )}
      </div>
    </GantryPanel>
  );
});
GantryIncidents.displayName = 'GantryIncidents';
