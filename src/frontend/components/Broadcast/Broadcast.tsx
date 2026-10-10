import { useMemo } from 'react';
import {
  sessionBarSelectors,
  useDriverTires,
  useFocusCarIdx,
  useSessionBarSelector,
  useSessionTimeTiming,
  useSessionVisibility,
  useTrackDisplayName,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { StandingsWidgetSettings } from '@irdashies/types';
import { clampSetting } from '@irdashies/utils/clampSetting';
import { useBroadcastSettings } from './hooks/useBroadcastSettings';
import { usePageRotation } from './hooks/usePageRotation';
import { usePositionChanges } from './hooks/usePositionChanges';
import { buildBroadcastRows, findBattle, racePhase } from './broadcastRows';
import { GridCard } from './components/PhaseScreens';
import { THEMES, TowerHeader } from './components/TowerHeader';
import { ClassHeader, DriverRow, PositionArrow } from './components/TowerRows';
import { BroadcastEnter, CheckerOverlay } from './BroadcastEnter';
import { BattleCard, FocusCard } from './components/TowerCards';
import { ROW_HEIGHT, rowAnimation, type Page } from './towerPages';

const BATTLE_GAP_SECONDS = 1;

// Gap and interval are what a viewer needs; everything else stays off.
const STANDINGS_OPTIONS = {
  gap: { enabled: true },
  interval: { enabled: true },
} as StandingsWidgetSettings['config'];

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

export const Broadcast = () => {
  const settings = useBroadcastSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const trackName = useTrackDisplayName();
  const groups = useDriverStandings(STANDINGS_OPTIONS, {
    showAll: true,
    livePositions: true,
  });
  const perClass = clampSetting(settings?.driversPerClass, 1, 30, 5);
  const standings = useMemo(() => groups.flatMap(([, d]) => d), [groups]);
  const sessionNum = useSessionBarSelector(sessionBarSelectors.sessionNum);
  const changes = usePositionChanges(standings, sessionNum);
  const focusCarIdx = useFocusCarIdx();
  const hasTyreChoice = (useDriverTires()?.length ?? 0) > 1;
  const rows = useMemo(
    () => buildBroadcastRows(groups, perClass, focusCarIdx),
    [groups, perClass, focusCarIdx]
  );
  // Rebuilt only when the set of classes or available pages changes, not on
  // every standings update, so the page rotation keeps its place.
  const classList = JSON.stringify(
    groups.map(([classId, drivers]) => [
      classId,
      drivers[0]?.carClass.name ?? '',
    ])
  );
  // Positions gained only exist in a race, against the qualifying grid.
  const hasGained = standings.some((s) => s.positionChange !== undefined);
  const hasPits = standings.some((s) => s.lastPitLap);
  const pages = useMemo<Page[]>(
    () => [
      { kind: 'names' },
      ...(JSON.parse(classList) as [string, string][]).map(
        ([classId, className]): Page => ({ kind: 'gaps', classId, className })
      ),
      ...(hasGained ? [{ kind: 'gained' } as const] : []),
      ...(hasPits ? [{ kind: 'pits' } as const] : []),
      ...(hasTyreChoice ? [{ kind: 'tyres' } as const] : []),
    ],
    [classList, hasGained, hasPits, hasTyreChoice]
  );
  const { page, tick, effect } = usePageRotation(
    pages,
    clampSetting(settings?.pageSeconds, 3, 30, 8),
    settings?.pageTransition
  );
  const battle =
    page.kind === 'gaps'
      ? findBattle(
          groups.find(([id]) => id === page.classId)?.[1] ?? [],
          perClass,
          BATTLE_GAP_SECONDS
        )
      : undefined;
  const focus = standings.find((s) => s.carIdx === focusCarIdx);
  const { sessionType, state: sessionState } = useSessionTimeTiming();
  // The podium after the flag is its own module, Broadcast Podium.
  const showGrid =
    settings?.phaseScreens !== false &&
    racePhase(sessionType, sessionState) === 'grid';
  const nameFormat = settings?.driverNameFormat ?? 'surname';
  const theme = settings?.theme ?? 'imsa';
  const look = THEMES[theme] ?? THEMES.imsa;

  if (!isSessionVisible || rows.length === 0) return null;

  return (
    <div
      className="flex w-full flex-col gap-2 text-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 85}%`,
        opacity: settings?.translucent?.enabled
          ? settings.translucent.opacity / 100
          : undefined,
      }}
    >
      <div className={`overflow-hidden rounded-sm shadow-lg ${look.panel}`}>
        <TowerHeader
          title={settings?.title || trackName || ''}
          logo={settings?.logo}
          theme={theme}
        />
        {/* Rows are absolutely placed so a position swap slides instead of jumping. */}
        <div
          className="relative"
          style={{ height: rows.length * ROW_HEIGHT + 4 }}
        >
          {rows.map((row, index) => {
            const change =
              row.kind === 'driver'
                ? changes.get(row.standing.carIdx)
                : undefined;
            return (
              <div
                key={row.key}
                className="absolute inset-x-0 transition-transform duration-700 ease-in-out"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${index * ROW_HEIGHT}px)`,
                }}
              >
                <div
                  key={tick}
                  className="relative h-full"
                  style={rowAnimation(effect, index)}
                >
                  {row.kind === 'class' ? (
                    <ClassHeader row={row} page={page} />
                  ) : (
                    <DriverRow
                      standing={row.standing}
                      page={page}
                      nameFormat={nameFormat}
                      positionStyle={look.position}
                      focused={row.standing.carIdx === focusCarIdx}
                    />
                  )}
                </div>
                {change && (
                  <PositionArrow key={change.seq} delta={change.delta} />
                )}
              </div>
            );
          })}
          {effect === 'checker' && (
            <CheckerOverlay key={tick} rows={rows.length} />
          )}
        </div>
        {battle && page.kind === 'gaps' && (
          <BroadcastEnter
            id={`${tick}-${battle[0].carIdx}-${battle[1].carIdx}`}
          >
            <div className="border-t-2 border-white/10 px-2 py-0.5 font-bold italic text-white uppercase">
              {page.className} battle for{' '}
              {ordinal(battle[0].classPosition ?? 0)}
            </div>
            <BattleCard standing={battle[0]} showGap={false} />
            <BattleCard standing={battle[1]} showGap />
          </BroadcastEnter>
        )}
      </div>
      {showGrid && (
        <BroadcastEnter id="grid">
          <GridCard groups={groups} perClass={perClass} />
        </BroadcastEnter>
      )}
      {settings?.showFocusCard !== false && focus && (
        <BroadcastEnter id={focus.carIdx}>
          <FocusCard standing={focus} />
        </BroadcastEnter>
      )}
    </div>
  );
};
