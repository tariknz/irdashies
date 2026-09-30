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
  useLapTimeHistory,
  useStandingsSelector,
  standingsSelectors,
  useCarIdxClassEstLapTime,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { recentOfficialLapPace } from '@irdashies/domain';
import { useIsSingleMake } from './hooks/useIsSingleMake';
import { computeStintLap } from './components/DriverInfoRow/cells/lapCountUtils';

/** Default window for the class lap projection when no setting is saved. */
const DEFAULT_ESTIMATED_LAPS_WINDOW = 5;

/** iRacing's "no limit" session time (IRSDK_UNLIMITED_TIME), one week. */
const UNLIMITED_SESSION_SECONDS = 604800;

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
    !!(
      settings?.lapTimeDeltas?.enabled ||
      settings?.avgLapTime?.enabled ||
      estimatedLapsEnabled
    )
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

  const {
    isFixedLapRace,
    totalLaps,
    timeRemaining,
    timeTotal,
    state,
    sessionNum,
  } = useSessionLapCount();
  const estimatedLapsWindow =
    settings?.classHeaderStyle?.estimatedLaps?.numLaps ??
    DEFAULT_ESTIMATED_LAPS_WINDOW;
  // iRacing's official lap times — the same source the session-wide lap
  // estimate in the header is built from, so a single-class race shows the
  // same projection in both places.
  const lapTimeHistory = useLapTimeHistory();
  // The leader's lap and lap distance must come from the same telemetry frame.
  // Mixed from channels ticking at different rates, the lap can tick over
  // while the distance still reads ~0.99 from the lap before, overshooting
  // the projection by a whole lap.
  const carIdxLap = useStandingsSelector(standingsSelectors.carIdxLap, {
    enabled: estimatedLapsEnabled,
  });
  const carIdxLapDistPct = useStandingsSelector(
    standingsSelectors.carIdxLapDistPct,
    { enabled: estimatedLapsEnabled }
  );
  // Last-resort pace when the leader has neither a lap in this race nor a
  // qualifying lap: iRacing's own baseline for the car/track/class, available
  // from the moment the session loads.
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const lastEstimateCache = useRef<Record<string, number>>({});
  const checkeredLapsCache = useRef<Record<string, number>>({});
  const lastOverrunSeconds = useRef(0);
  const lastSessionNum = useRef<number | null>(null);
  const estimatedLapsByClass = useMemo(() => {
    if (!estimatedLapsEnabled) return {};
    if (sessionNum !== lastSessionNum.current) {
      lastSessionNum.current = sessionNum;
      lastEstimateCache.current = {};
      checkeredLapsCache.current = {};
      lastOverrunSeconds.current = 0;
    }
    if (state < SessionState.Checkered) {
      checkeredLapsCache.current = {};
    }
    // Before the green flag iRacing's race clock isn't running: during the
    // warmup and pace lap SessionTimeRemain is unset, so the snapshot reads the
    // race as fixed-lap even when it's timed. Only a scheduled lap count
    // makes it a fixed-lap race; anything else is timed, projected from the
    // race length until the clock starts.
    const fixedLapRace = isFixedLapRace && totalLaps > 0;
    const isGreen = state >= SessionState.Racing;
    const clockRunning =
      timeRemaining > 0 && timeRemaining < UNLIMITED_SESSION_SECONDS;
    const raceLength =
      timeTotal > 0 && timeTotal < UNLIMITED_SESSION_SECONDS
        ? timeTotal
        : undefined;

    const lastEstimate = lastEstimateCache.current;
    const checkeredCache = checkeredLapsCache.current;

    // The car with the most track progress (lap + distance into it), read
    // from the same frame. Undefined when no car in the class has a lap.
    const progressLeader = <T extends { carIdx: number }>(
      classStandings: readonly T[]
    ): T | undefined => {
      let leader: T | undefined;
      let leaderProgress = 0;
      for (const standing of classStandings) {
        const lap = carIdxLap?.[standing.carIdx] ?? -1;
        if (lap <= 0) continue;
        const progress =
          lap + Math.max(0, carIdxLapDistPct?.[standing.carIdx] ?? 0);
        if (progress > leaderProgress) {
          leader = standing;
          leaderProgress = progress;
        }
      }
      return leader;
    };

    type ClassProjection =
      | { classId: string; estimate: ClassLapEstimate }
      | {
          classId: string;
          currentLap: number;
          /** Laps the class leader completes by the time the clock runs out. */
          laps: number;
          pace: number;
        };

    const projections = standings
      .map(([classId, classStandings]): ClassProjection | undefined => {
        // iRacing reports -1 for cars with no lap on the board, and the class
        // leader on results position can be one of them (garage, no time
        // set). Take the furthest lap in the class instead, so the count
        // reflects where the class actually is. From the green flag the class
        // is on lap 1, even before a rolling start brings its leader across
        // the line.
        const currentLap = classStandings.reduce(
          (furthest, standing) => Math.max(furthest, standing.lastLap ?? 0),
          isGreen ? 1 : 0
        );

        // Once the checkered flag is out the race distance is whatever the
        // leader had on the board at that moment — same as the global
        // header. Latched, because CarIdxLap can reset to 0 for cars that
        // have since left the track, and checked ahead of the fixed-lap check
        // since a race can finish either way.
        if (state >= SessionState.Checkered) {
          if (!checkeredCache[classId] && currentLap > 0) {
            checkeredCache[classId] = currentLap;
          }
          const finalLap = checkeredCache[classId] ?? currentLap;
          return {
            classId,
            estimate: { currentLap: finalLap, total: finalLap, exact: true },
          };
        }

        if (fixedLapRace) {
          return {
            classId,
            estimate: { currentLap, total: totalLaps, exact: true },
          };
        }

        // No fresh projection — hold the last one rather than dropping the
        // estimate for a frame.
        const held = lastEstimate[classId];
        const holdLastEstimate = (): ClassProjection | undefined =>
          held !== undefined
            ? {
                classId,
                estimate: { currentLap, total: held, exact: false },
              }
            : undefined;

        // Recomputed on every update rather than latched per lap, like the
        // global estimate: the official lap time lands a few ticks after the
        // leader crosses the line, so a value frozen at the crossing would
        // miss the lap just completed.
        //
        // The leader is the car furthest round the track, not the first row:
        // the row order comes from iRacing's results, which can put a car with
        // no lap on the board first (a qualifier still in the garage, a
        // leader who disconnected) until the results catch up. Projecting from
        // that car would freeze the estimate at the full-race value. Before
        // the green flag, grid positions and lap counters don't order the
        // field, so the first row (the class pole sitter) is kept there.
        const leader =
          (isGreen ? progressLeader(classStandings) : undefined) ??
          classStandings[0];
        // Pace, best source first: the leader's recent official laps; then
        // their best lap, which before the green flag is their qualifying lap
        // — close to race pace, where iRacing's class estimate runs a few
        // percent optimistic; then that class estimate.
        const pace =
          (leader
            ? recentOfficialLapPace(
                lapTimeHistory[leader.carIdx] ?? [],
                estimatedLapsWindow
              )
            : undefined) ??
          (leader && leader.fastestTime > 0 ? leader.fastestTime : undefined) ??
          (leader ? classEstLapTimes?.[leader.carIdx] : undefined);
        if (!pace || pace <= 0) return holdLastEstimate();

        const leaderLap = leader ? (carIdxLap?.[leader.carIdx] ?? 0) : 0;
        const leaderLapDistPct = leader
          ? (carIdxLapDistPct?.[leader.carIdx] ?? 0)
          : 0;
        if (!isGreen || leaderLap <= 0) {
          // Grid, pace lap, or a rolling start before the leader reaches the
          // line: the whole race is still ahead.
          if (raceLength === undefined) return holdLastEstimate();
          return { classId, currentLap, laps: raceLength / pace, pace };
        }
        if (!clockRunning) return holdLastEstimate();
        return {
          classId,
          currentLap,
          laps: timeRemaining / pace + (leaderLap - 1) + leaderLapDistPct,
          pace,
        };
      })
      .filter((entry): entry is ClassProjection => entry !== undefined);

    // The checkered flag goes to the overall leader on their first crossing
    // after the clock runs out; every other class then finishes on its own
    // next crossing. So the other classes race on for however long the
    // overall leader takes to finish the lap they're on at zero.
    const overallLeaderClassId = standings.find(([, classStandings]) =>
      classStandings.some((standing) => standing.position === 1)
    )?.[0];
    const overallLeader = projections.find(
      (projection) => projection.classId === overallLeaderClassId
    );
    if (overallLeader && 'laps' in overallLeader) {
      lastOverrunSeconds.current =
        (Math.ceil(overallLeader.laps) - overallLeader.laps) *
        overallLeader.pace;
    }
    const overrunSeconds = lastOverrunSeconds.current;

    return Object.fromEntries(
      projections.map((projection): [string, ClassLapEstimate] => {
        if ('estimate' in projection) {
          return [projection.classId, projection.estimate];
        }
        const { classId, currentLap, laps, pace } = projection;
        let total =
          classId === overallLeaderClassId
            ? laps
            : laps + overrunSeconds / pace;
        if (totalLaps > 0) total = Math.min(total, totalLaps);
        lastEstimate[classId] = total;
        return [classId, { currentLap, total, exact: false }];
      })
    );
  }, [
    estimatedLapsEnabled,
    sessionNum,
    isFixedLapRace,
    totalLaps,
    timeRemaining,
    timeTotal,
    state,
    standings,
    lapTimeHistory,
    estimatedLapsWindow,
    carIdxLap,
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
