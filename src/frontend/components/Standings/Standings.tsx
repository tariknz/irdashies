import { Fragment, useMemo, useRef } from 'react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { SessionBar } from './components/SessionBar/SessionBar';

import { TitleBar } from './components/TitleBar/TitleBar';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
  useHighlightColor,
  useDriverTagMap,
  useManufacturerCounts,
  useSessionLapCount,
} from './hooks';
import {
  useGeneralSettings,
  useLapTimesStoreUpdater,
  useP2PDisplayStates,
  useDrivingState,
  useWeekendInfoNumCarClasses,
  useWeekendInfoTeamRacing,
  useSessionVisibility,
  useCarIdxRollingAvgLapTime,
  usePitStopDuration,
  usePitLaneStore,
  useFirstObservedLap,
  useLapHistorySnapshot,
  useTrackStateSelector,
  trackStateSelectors,
  useCarIdxClassEstLapTime,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { readCrossings, recentGreenLapPace } from '@irdashies/domain';
import { useIsSingleMake } from './hooks/useIsSingleMake';
import { computeStintLap } from './components/DriverInfoRow/cells/lapCountUtils';

/** Default window for the class lap projection when no setting is saved. */
const DEFAULT_ESTIMATED_LAPS_WINDOW = 5;

const COLUMN_LABELS: Record<string, string> = {
  position: '',
  carNumber: '',
  driverTag: 'TAG',
  countryFlags: '',
  driverName: '',
  teamName: '',
  pitStatus: 'PIT',
  carManufacturer: '',
  badge: '',
  iratingChange: '',
  positionChange: '',
  delta: 'DELTA',
  gap: 'GAP',
  interval: 'INT',
  fastestTime: 'BEST',
  lastTime: 'LAST',
  compound: 'TIRE',
  lapTimeDeltas: 'DELTA',
  avgLapTime: 'AVG',
  lapCount: 'LAPS',
  pushToPass: 'P2P',
};

const COLUMN_ORDER = Object.keys(COLUMN_LABELS);

export interface ClassLapEstimate {
  /** Furthest lap the class has on the board. */
  currentLap: number;
  /** Laps at the checkered — scheduled in a fixed-lap race, projected in a timed one. */
  total: number;
  /** True when the total is the race distance rather than a pace projection. */
  exact: boolean;
}

export interface OrderedColumn {
  id: string;
  label: string;
  colSpan: number;
  kind: 'identity' | 'data';
}

// Ordered list of every enabled data column, matching the exact column
// structure (id order + colSpan) that DriverInfoRow renders as <td>s, so
// a header row built from this list lines up with the data cells below.
const getOrderedColumns = (
  config: NonNullable<ReturnType<typeof useStandingsSettings>>,
  hasAnyDriverTag: boolean,
  hasAnyCountryFlag: boolean,
  isTeamRacing: boolean,
  hideCarManufacturer: boolean
): OrderedColumn[] => {
  const isEnabled = (value: unknown): boolean =>
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value &&
    value.enabled === true;
  const enabledColumns = new Set(
    COLUMN_ORDER.filter((id) => {
      const column = config?.[id as keyof typeof config];
      if (id === 'driverTag') return isEnabled(column) && hasAnyDriverTag;
      if (id === 'countryFlags') {
        return isEnabled(column) && hasAnyCountryFlag;
      }
      if (id === 'teamName') return isEnabled(column) && isTeamRacing;
      if (id === 'carManufacturer') {
        return isEnabled(column) && !hideCarManufacturer;
      }
      if (id === 'delta') return isEnabled(column) && !('gap' in config);
      return isEnabled(column);
    })
  );
  const orderedColumns = [
    ...(config.displayOrder ?? []),
    ...COLUMN_ORDER,
  ].filter(
    (id, index, order) => enabledColumns.has(id) && order.indexOf(id) === index
  );

  return orderedColumns.map((id) => {
    const label = COLUMN_LABELS[id];
    return {
      id,
      label,
      colSpan:
        id === 'lapTimeDeltas'
          ? Math.max(1, config.lapTimeDeltas?.numLaps ?? 1)
          : 1,
      // Columns without a label (position, driver name, ...) are merged
      // into the class header's info bar; columns with a label get their
      // own header cell so it lines up with the matching data column.
      kind: label ? 'data' : 'identity',
    };
  });
};

export const Standings = () => {
  const settings = useStandingsSettings();
  const generalSettings = useGeneralSettings();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const estimatedLapsEnabled =
    !!settings?.classHeaderStyle?.estimatedLaps?.enabled;

  useLapTimesStoreUpdater(
    !!(settings?.lapTimeDeltas?.enabled || settings?.avgLapTime?.enabled)
  );

  const p2pDisplayStates = useP2PDisplayStates();

  const standings = useDriverStandings(settings);
  const hasAnyCountryFlag = useMemo(
    () =>
      standings.some(([, classStandings]) =>
        classStandings.some((result) => (result.driver?.flairId ?? 0) > 0)
      ),
    [standings]
  );
  const manufacturerCountsByClass = useManufacturerCounts(
    !!settings?.classHeaderStyle?.manufacturerStats?.enabled
  );
  const classStats = useCarClassStats();
  const { tagMap, hasAnyTag } = useDriverTagMap(settings?.driverTag?.enabled);
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;
  const highlightColor = useHighlightColor();

  const avgLapTimes = useCarIdxRollingAvgLapTime(
    settings?.avgLapTime?.numLaps ?? 5
  );

  const { isFixedLapRace, totalLaps, timeRemaining, timeTotal, state } =
    useSessionLapCount();
  const estimatedLapsWindow =
    settings?.classHeaderStyle?.estimatedLaps?.numLaps ??
    DEFAULT_ESTIMATED_LAPS_WINDOW;
  const lapHistory = useLapHistorySnapshot(estimatedLapsEnabled);
  const carIdxLapDistPct = useTrackStateSelector(
    trackStateSelectors.carIdxLapDistPct,
    { enabled: estimatedLapsEnabled }
  );
  // Before the green flag (pace/parade lap), nobody has set a lap in this
  // session yet, so there's neither local green-lap history nor a live best
  // lap to fall back on. CarClassEstLapTime is iRacing's own baseline pace
  // for the car/track/class and is available from the moment the session
  // loads, so it keeps an estimate on screen through the pace lap instead of
  // showing nothing until the first lap is set.
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const estimatedLapsCache = useRef<
    Record<string, { leaderLap: number; total: number }>
  >({});
  const checkeredLapsCache = useRef<Record<string, number>>({});
  const lastSessionNum = useRef<number | null>(null);
  const estimatedLapsByClass = useMemo(() => {
    if (!estimatedLapsEnabled) return {};
    const sessionNum = lapHistory?.sessionNum ?? null;
    if (sessionNum !== lastSessionNum.current) {
      lastSessionNum.current = sessionNum;
      estimatedLapsCache.current = {};
      checkeredLapsCache.current = {};
    }
    if (state < SessionState.Checkered) {
      checkeredLapsCache.current = {};
    }
    const canProject = isFixedLapRace ? totalLaps > 0 : timeRemaining > 0;
    if (!canProject && state < SessionState.Checkered) return {};

    const cache = estimatedLapsCache.current;
    const checkeredCache = checkeredLapsCache.current;

    return Object.fromEntries(
      standings
        .map(
          ([classId, classStandings]):
            [string, ClassLapEstimate] | undefined => {
            // iRacing reports -1 for cars with no lap on the board, and the
            // class leader on results position can be one of them (garage, no
            // time set). Take the furthest lap in the class instead, so the
            // count reflects where the class actually is.
            const currentLap = classStandings.reduce(
              (furthest, standing) => Math.max(furthest, standing.lastLap ?? 0),
              0
            );

            // Once the checkered flag is out the race distance is whatever
            // the leader had on the board at that moment — same as the
            // global header. Latched, because CarIdxLap can reset to 0 for
            // cars that have since left the track, and checked ahead of
            // isFixedLapRace/canProject since a race can finish either way.
            if (state >= SessionState.Checkered) {
              if (!checkeredCache[classId] && currentLap > 0) {
                checkeredCache[classId] = currentLap;
              }
              const finalLap = checkeredCache[classId] ?? currentLap;
              return [
                classId,
                { currentLap: finalLap, total: finalLap, exact: true },
              ];
            }

            if (isFixedLapRace) {
              return [classId, { currentLap, total: totalLaps, exact: true }];
            }

            if (!canProject) return undefined;

            const leader = classStandings[0];
            const leaderLap = leader?.lastLap ?? 0;
            const cached = cache[classId];
            if (cached && cached.leaderLap === leaderLap) {
              return [
                classId,
                { currentLap, total: cached.total, exact: false },
              ];
            }

            // Our own green-lap history only has crossings observed since this
            // overlay started watching — a spectator who just tuned in mid-race
            // has none yet. iRacing's own best-lap telemetry is populated for
            // the whole session regardless of when we joined, so it's the
            // fallback until enough local history builds up to take over.
            const observedPace =
              leader && lapHistory
                ? recentGreenLapPace(
                    readCrossings(lapHistory, leader.carIdx),
                    estimatedLapsWindow
                  )
                : undefined;
            const leaderPace =
              observedPace ??
              (leader && leader.fastestTime > 0
                ? leader.fastestTime
                : undefined) ??
              (leader ? classEstLapTimes?.[leader.carIdx] : undefined);

            // No fresh pace to recompute with — hold the last projection
            // rather than dropping the estimate for a frame.
            if (!leaderPace || leaderPace <= 0) {
              return cached
                ? [classId, { currentLap, total: cached.total, exact: false }]
                : undefined;
            }

            const leaderLapDistPct = leader
              ? (carIdxLapDistPct?.[leader.carIdx] ?? 0)
              : 0;
            let total =
              leaderLap <= 0
                ? timeTotal / leaderPace
                : timeRemaining / leaderPace +
                  (leaderLap - 1) +
                  leaderLapDistPct;
            if (totalLaps > 0) total = Math.min(total, totalLaps);

            cache[classId] = { leaderLap, total };
            return [classId, { currentLap, total, exact: false }];
          }
        )
        .filter(
          (entry): entry is [string, ClassLapEstimate] => entry !== undefined
        )
    );
  }, [
    estimatedLapsEnabled,
    isFixedLapRace,
    totalLaps,
    timeRemaining,
    timeTotal,
    state,
    standings,
    lapHistory,
    estimatedLapsWindow,
    carIdxLapDistPct,
    classEstLapTimes,
  ]);

  const pitStopDurations = usePitStopDuration();
  const firstObservedLaps = useFirstObservedLap();
  const pitExitPct = usePitLaneStore((s) => s.pitExitPct);
  const pitExitAfterSF = pitExitPct !== null && pitExitPct > 0.85;

  // Determine whether we should hide the car manufacturer column
  const isSingleMake = useIsSingleMake(
    !!settings?.carManufacturer?.hideIfSingleMake
  );
  const hideCarManufacturer = !!(
    settings?.carManufacturer?.hideIfSingleMake && isSingleMake
  );

  const topDriverDivider =
    settings?.driverStandings?.topDriverDivider ?? 'none';
  const numTopDrivers = settings?.driverStandings?.numTopDrivers ?? 0;

  // Check if this is a team racing session
  const isTeamRacing = useWeekendInfoTeamRacing();

  const orderedColumns = useMemo(
    () =>
      settings && settings.stylingOptions?.columnHeaders?.enabled
        ? getOrderedColumns(
            settings,
            hasAnyTag,
            !!hasAnyCountryFlag,
            !!isTeamRacing,
            hideCarManufacturer
          )
        : undefined,
    [settings, hasAnyTag, hasAnyCountryFlag, isTeamRacing, hideCarManufacturer]
  );

  // Determine table border spacing based on compact mode
  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';
  const tableBorderSpacing = isCompact
    ? 'border-spacing-y-0'
    : 'border-spacing-y-0.5';
  const scale = Math.min(200, Math.max(50, settings?.scale ?? 100)) / 100;

  if (!isSessionVisible) return <></>;

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <div
        className={`bg-slate-800/(--bg-opacity) rounded-sm text-white ${!isCompact ? 'p-2' : ''}`}
        style={{
          ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 0}%`,
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <TitleBar titleBarSettings={settings?.titleBar} />
        {settings?.headerBar && (settings.headerBar.enabled ?? true) && (
          <SessionBar
            settings={settings.headerBar}
            opacity={settings?.foreground?.opacity}
            position="header"
          />
        )}
        <table
          className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
        >
          <tbody>
            {standings.map(([classId, classStandings], index) => {
              // Compute divider color once per class
              // Priority: theme selected → CSS theme var; multi-class → class color; else → highlight
              const classColorNum = classStats?.[classId]?.color;
              const classColorHex =
                classColorNum !== undefined
                  ? `#${classColorNum.toString(16).padStart(6, '0')}`
                  : undefined;
              const highlightHex = `#${highlightColor.toString(16).padStart(6, '0')}`;
              // var(--color-slate-500) inherits from ThemeManager's CSS remapping,
              // resolving to the user's selected theme color at runtime.
              const dividerColor =
                topDriverDivider === 'theme'
                  ? 'var(--color-slate-500)'
                  : isMultiClass
                    ? (classColorHex ?? highlightHex)
                    : highlightHex;

              const manufacturerStats = manufacturerCountsByClass[classId];

              return classStandings.length > 0 ? (
                <Fragment key={classId}>
                  <DriverClassHeader
                    key={classId}
                    className={classStats?.[classId]?.shortName}
                    classColor={
                      isMultiClass
                        ? classStats?.[classId]?.color
                        : highlightColor
                    }
                    totalDrivers={classStats?.[classId]?.total}
                    sof={classStats?.[classId]?.sof}
                    estimatedLaps={estimatedLapsByClass[classId]}
                    highlightColor={highlightColor}
                    isMultiClass={isMultiClass}
                    colSpan={100}
                    classHeaderStyle={settings?.classHeaderStyle}
                    compactMode={generalSettings?.compactMode}
                    manufacturerCounts={manufacturerStats?.counts}
                    playerManufacturerEntry={manufacturerStats?.playerEntry}
                    orderedColumns={orderedColumns}
                  />
                  {classStandings.map((result, driverIndex) => {
                    const prev = classStandings[driverIndex - 1];
                    const showDivider =
                      topDriverDivider !== 'none' &&
                      numTopDrivers > 0 &&
                      driverIndex > 0 &&
                      prev?.classPosition !== undefined &&
                      result.classPosition !== undefined &&
                      prev.classPosition <= numTopDrivers &&
                      result.classPosition > numTopDrivers &&
                      result.classPosition > prev.classPosition + 1;

                    // Stint lap = laps since last observed pit. Blank/unknown when
                    // we lack the data to compute it reliably, and hidden entirely
                    // for cars not out on track (see computeStintLap).
                    const stintLap = computeStintLap({
                      lastLap: result.lastLap,
                      lastPitLap: result.lastPitLap,
                      firstObservedLap: firstObservedLaps[result.carIdx],
                      pitExitAfterSF,
                      onTrack: result.onTrack,
                    });

                    return (
                      <Fragment key={result.carIdx}>
                        {showDivider && (
                          <tr>
                            <td colSpan={100} className="px-2 py-0.5">
                              <hr
                                className="border-2 border-t"
                                style={{
                                  borderColor: dividerColor,
                                  opacity: 0.5,
                                }}
                              />
                            </td>
                          </tr>
                        )}
                        <DriverInfoRow
                          key={result.carIdx}
                          carIdx={result.carIdx}
                          resolvedTag={tagMap.get(result.carIdx)}
                          hasAnyDriverTag={hasAnyTag}
                          hasAnyCountryFlag={hasAnyCountryFlag}
                          classColor={result.carClass.color}
                          carNumber={
                            (settings?.carNumber?.enabled ?? true)
                              ? result.driver?.carNum || ''
                              : undefined
                          }
                          name={result.driver?.name || ''}
                          teamName={
                            settings?.teamName?.enabled && isTeamRacing
                              ? result.driver?.teamName || ''
                              : undefined
                          }
                          isPlayer={result.isPlayer}
                          hasFastestTime={result.hasFastestTime}
                          delta={
                            settings?.delta?.enabled ? result.delta : undefined
                          }
                          gap={settings?.gap?.enabled ? result.gap : undefined}
                          interval={
                            settings?.interval?.enabled
                              ? result.interval
                              : undefined
                          }
                          position={result.classPosition}
                          lap={result.lastLap}
                          iratingChangeValue={result.iratingChange}
                          positionChange={result.positionChange}
                          lastTime={
                            settings?.lastTime?.enabled
                              ? result.lastTime
                              : undefined
                          }
                          fastestTime={
                            settings?.fastestTime?.enabled
                              ? result.fastestTime
                              : undefined
                          }
                          lastTimeState={
                            settings?.lastTime?.enabled
                              ? result.lastTimeState
                              : undefined
                          }
                          onPitRoad={result.onPitRoad}
                          onTrack={result.onTrack}
                          radioActive={result.radioActive}
                          isMultiClass={isMultiClass}
                          flairId={
                            (settings?.countryFlags?.enabled ?? true)
                              ? result.driver?.flairId
                              : undefined
                          }
                          tireCompound={
                            (settings?.compound?.enabled ?? true)
                              ? result.tireCompound
                              : undefined
                          }
                          carId={result.carId}
                          lastPitLap={result.lastPitLap}
                          lastLap={result.lastLap}
                          carTrackSurface={result.carTrackSurface}
                          prevCarTrackSurface={result.prevCarTrackSurface}
                          license={result.driver?.license}
                          rating={result.driver?.rating}
                          lapTimeDeltas={
                            settings?.lapTimeDeltas?.enabled
                              ? result.lapTimeDeltas
                              : undefined
                          }
                          numLapDeltasToShow={
                            settings?.lapTimeDeltas?.enabled
                              ? settings.lapTimeDeltas.numLaps
                              : undefined
                          }
                          avgLapTime={
                            settings?.avgLapTime?.enabled
                              ? avgLapTimes[result.carIdx]
                              : undefined
                          }
                          displayOrder={settings?.displayOrder}
                          currentSessionType={result.currentSessionType}
                          config={settings}
                          highlightColor={highlightColor}
                          dnf={result.dnf}
                          repair={result.repair}
                          penalty={result.penalty}
                          slowdown={result.slowdown}
                          pitStopDuration={pitStopDurations[result.carIdx]}
                          currentLap={stintLap.lap}
                          lapCountUnknown={stintLap.unknown}
                          pitExitAfterSF={pitExitAfterSF}
                          hideCarManufacturer={hideCarManufacturer}
                          hideLeaderGapIntervalLabels={
                            settings?.stylingOptions?.columnHeaders?.enabled ??
                            false
                          }
                          compactMode={generalSettings?.compactMode}
                          p2pDisplayState={p2pDisplayStates[result.carIdx]}
                        />
                      </Fragment>
                    );
                  })}
                  {standings
                    .slice(index + 1)
                    .some(([, content]) => content.length > 0) &&
                    !isCompact && (
                      <tr>
                        <td colSpan={100} className="h-2"></td>
                      </tr>
                    )}
                </Fragment>
              ) : null;
            })}
          </tbody>
        </table>
        {settings?.footerBar && (settings.footerBar.enabled ?? true) && (
          <SessionBar
            settings={settings.footerBar}
            opacity={settings?.foreground?.opacity}
            position="footer"
          />
        )}
      </div>
    </div>
  );
};
