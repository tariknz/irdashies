import { useMemo } from 'react';
import { perfMetrics } from '@irdashies/utils/perfMetrics';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useSessionFastestLaps,
  useSessionIsOfficial,
  useSessionPositions,
  useSessionType,
  useStandingsSnapshot,
  useLapTimeHistory,
  useWeekendInfoEventType,
} from '@irdashies/context';
import {
  createDriverStandings,
  groupStandingsByClass,
  groupStandingsBySpeed,
  sliceRelevantDrivers,
  augmentStandingsWithIRating,
  augmentStandingsWithGap,
  augmentStandingsWithInterval,
  augmentStandingsWithPlayerGap,
  augmentStandingsWithPositionChange,
} from './createStandings';
import type {
  Driver,
  SessionResults,
  StandingsWidgetSettings,
} from '@irdashies/types';
import type { Standings } from './createStandings';
import {
  competitorsOnly,
  excludedStandings,
  reRankClassPositions,
} from '../broadcast/excludedCars';
import { useDriverLivePositions } from './useDriverLivePositions';
import { useStandingsSettings } from './useStandingsSettings';
import { useRadioActiveCarIdxs } from './useRadioActiveCarIdxs';
import { useQualifyingResults } from './useQualifyingGrid';
import { measureStandingsRebuild } from './standingsCost';
import { SessionState, TrackLocation } from '@irdashies/types';
import { augmentStandingsWithFinalTiming } from './finalRaceTiming';

const EMPTY_NUMBERS: number[] = [];
const EMPTY_BOOLEANS: boolean[] = [];
const EMPTY_TRACK_LOCATIONS: TrackLocation[] = [];
const EMPTY_STANDINGS: Standings[] = [];

export interface DriverStandingsOptions {
  showAll?: boolean;
  livePositions?: boolean;
  excludedCarIdxs?: ReadonlySet<number>;
}

export interface DriverStandingsWithExcluded {
  groups: [string, Standings[]][];
  excluded: Standings[];
}

const excludedOnly = <T extends { CarIdx: number }>(
  items: T[] | undefined,
  excludedIdxs: ReadonlySet<number>
): T[] | undefined => items?.filter((item) => excludedIdxs.has(item.CarIdx));

export const shouldCalculateIRatingChange = (
  eventType: string | undefined,
  isOfficial: boolean,
  sessionType: string | undefined,
  estimateInPractice: boolean
) =>
  (eventType === 'Race' && isOfficial) ||
  (eventType === 'Practice' &&
    sessionType === 'Practice' &&
    estimateInPractice);

/**
 * The Standings widget's rows: every driver with position, gaps, lap times
 * and car state, grouped by class and trimmed to the widget's settings.
 */
export const useDriverStandings = (
  settings?: StandingsWidgetSettings['config'],
  options?: DriverStandingsOptions
) => useDriverStandingsWithExcluded(settings, options).groups;

export const useDriverStandingsWithExcluded = (
  settings?: StandingsWidgetSettings['config'],
  options?: DriverStandingsOptions
): DriverStandingsWithExcluded => {
  const {
    driverStandings: {
      buffer,
      numNonClassDrivers,
      minPlayerClassDrivers,
      numTopDrivers,
    } = {},
    gap: { enabled: gapEnabled, reference: gapReference } = { enabled: false },
    interval: {
      enabled: intervalEnabled,
      displayMode: intervalDisplayMode = 'time',
    } = { enabled: false },
    lapTimeDeltas: { enabled: lapTimeDeltasEnabled, numLaps: numLapDeltas } = {
      enabled: false,
      numLaps: 3,
    },
  } = settings ?? {};

  const sessionDrivers = useSessionDrivers();
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const standingsSnapshot = useStandingsSnapshot();
  const driverCarIdx = standingsSnapshot?.focusCarIdx ?? undefined;
  // The player's own car, which the pit estimate describes. Not driverCarIdx,
  // which follows the camera.
  const ownCarIdx = useDriverCarIdx();
  const sessionNum = standingsSnapshot?.sessionNum ?? undefined;
  const finalRaceTiming = standingsSnapshot?.finalRaceTiming;
  const sessionState = standingsSnapshot?.sessionState ?? 0;
  const sessionType = useSessionType(sessionNum);
  const positions = useSessionPositions(sessionNum);
  const allQualifyingResults = useQualifyingResults();
  const excludedIdxs = options?.excludedCarIdxs;
  const qualifyingResults = useMemo(
    () => competitorsOnly(allQualifyingResults, excludedIdxs, sessionDrivers),
    [allQualifyingResults, excludedIdxs, sessionDrivers]
  );
  const resultsPositions = useMemo(
    () => competitorsOnly(positions, excludedIdxs, sessionDrivers),
    [positions, excludedIdxs, sessionDrivers]
  );
  const standingsSettings = useStandingsSettings();
  const useLivePositionStandings =
    options?.livePositions ?? standingsSettings?.useLivePosition ?? false;
  const customClassOrdering = standingsSettings?.customClassOrdering ?? false;
  const driverLivePositions = useDriverLivePositions({
    enabled: useLivePositionStandings,
  });
  const fastestLaps = useSessionFastestLaps(sessionNum);
  const carIdxLastLapTime =
    standingsSnapshot?.carIdxLastLapTime ?? EMPTY_NUMBERS;
  const carIdxBestLapTime =
    standingsSnapshot?.carIdxBestLapTime ?? EMPTY_NUMBERS;
  const carIdxF2Time = standingsSnapshot?.carIdxF2Time ?? EMPTY_NUMBERS;
  const carIdxEstTime = standingsSnapshot?.carIdxEstTime ?? EMPTY_NUMBERS;
  const carIdxOnPitRoad = standingsSnapshot?.carIdxOnPitRoad ?? EMPTY_BOOLEANS;
  const carIdxLap = standingsSnapshot?.carIdxLap ?? EMPTY_NUMBERS;
  const carIdxLapDistPct = standingsSnapshot?.carIdxLapDistPct ?? EMPTY_NUMBERS;
  const carIdxTrackSurface = (standingsSnapshot?.carIdxTrackSurface ??
    EMPTY_TRACK_LOCATIONS) as TrackLocation[];
  const radioTransmitCarIdx = useRadioActiveCarIdxs(
    (settings?.radio?.persistenceSeconds ?? 3) * 1000
  );
  const carIdxTireCompound =
    standingsSnapshot?.carIdxTireCompound ?? EMPTY_NUMBERS;
  const carIdxSessionFlags =
    standingsSnapshot?.carIdxSessionFlags ?? EMPTY_NUMBERS;
  const carIdxWheelCompounds =
    standingsSnapshot?.carIdxWheelCompounds ?? EMPTY_NUMBERS;
  const carIdxTrackLimitsPoints =
    standingsSnapshot?.carIdxTrackLimitsPoints ?? EMPTY_NUMBERS;
  const carIdxEnergyRemaining =
    standingsSnapshot?.carIdxEnergyRemaining ?? EMPTY_NUMBERS;
  const carIdxPenalties = standingsSnapshot?.carIdxPenalties ?? EMPTY_NUMBERS;
  const carIdxPenaltyKind =
    standingsSnapshot?.carIdxPenaltyKind ?? EMPTY_NUMBERS;
  const carIdxPenaltySeconds =
    standingsSnapshot?.carIdxPenaltySeconds ?? EMPTY_NUMBERS;
  const carIdxFinishStatus =
    standingsSnapshot?.carIdxFinishStatus ?? EMPTY_NUMBERS;
  const penaltySeconds = standingsSnapshot?.penaltySeconds;
  const isOfficial = useSessionIsOfficial();
  const eventType = useWeekendInfoEventType();
  const lastPitLap = standingsSnapshot?.lastPitLap ?? EMPTY_NUMBERS;
  const lastLap = carIdxLap;
  const prevCarTrackSurface =
    standingsSnapshot?.previousCarTrackSurface ?? EMPTY_NUMBERS;
  const driverClass = useMemo(() => {
    return sessionDrivers?.find((driver) => driver.CarIdx === driverCarIdx)
      ?.CarClassID;
  }, [sessionDrivers, driverCarIdx]);
  const lapTimeHistory = useLapTimeHistory();

  const lapDeltasForCalc = useMemo(
    () =>
      calculateLapDeltas(lapTimeHistory, driverCarIdx, lapTimeDeltasEnabled),
    [lapTimeDeltasEnabled, lapTimeHistory, driverCarIdx]
  );

  const standingsWithGain = useMemo(
    () =>
      measureStandingsRebuild('standings', sessionDrivers?.length ?? 0, () => {
        const buildStandings = (
          drivers: Driver[] | undefined,
          results: SessionResults[] | undefined,
          qualifying: SessionResults[] | undefined,
          excludedCarIdxs: ReadonlySet<number> | undefined
        ) =>
          createDriverStandings(
            {
              playerIdx: driverCarIdx,
              ownCarIdx,
              drivers,
              qualifyingResults: qualifying,
              excludedCarIdxs,
            },
            {
              carIdxLastLapTime: carIdxLastLapTime,
              carIdxBestLapTime: carIdxBestLapTime,
              carIdxF2TimeValue: carIdxF2Time,
              carIdxOnPitRoadValue: carIdxOnPitRoad,
              carIdxTrackSurfaceValue: carIdxTrackSurface,
              radioTransmitCarIdx: radioTransmitCarIdx,
              carIdxTireCompoundValue: carIdxTireCompound,
              carIdxWheelCompoundsValue: carIdxWheelCompounds,
              carIdxTrackLimitsPointsValue: carIdxTrackLimitsPoints,
              carIdxEnergyRemainingValue: carIdxEnergyRemaining,
              carIdxPenaltiesValue: carIdxPenalties,
              carIdxPenaltyKindValue: carIdxPenaltyKind,
              carIdxPenaltySecondsValue: carIdxPenaltySeconds,
              carIdxFinishStatusValue: carIdxFinishStatus,
              penaltySeconds,
              carIdxSessionFlags: carIdxSessionFlags,
            },
            {
              resultsPositions: results,
              resultsFastestLap: fastestLaps,
              sessionType,
            },
            lastPitLap,
            lastLap,
            prevCarTrackSurface,
            lapTimeDeltasEnabled ? numLapDeltas : undefined,
            lapDeltasForCalc
          );

        const initialStandings = buildStandings(
          sessionDrivers,
          resultsPositions,
          qualifyingResults,
          excludedIdxs
        );
        const excluded = excludedIdxs?.size
          ? excludedStandings(
              buildStandings(
                excludedOnly(sessionDrivers, excludedIdxs),
                excludedOnly(positions, excludedIdxs),
                excludedOnly(allQualifyingResults, excludedIdxs),
                undefined
              )
            )
          : EMPTY_STANDINGS;

        if (useLivePositionStandings) {
          // Apply live positions as per-class positions, then sort class arrays by class position
          initialStandings.forEach((standing) => {
            const livePosition = driverLivePositions[standing.carIdx];
            if (livePosition !== undefined)
              standing.classPosition = livePosition;
          });
        }

        // Group and *sort drivers inside each class by classPosition* (this respects live positions)
        let groupedByClass = customClassOrdering
          ? groupStandingsBySpeed(initialStandings)
          : groupStandingsByClass(initialStandings);
        if (useLivePositionStandings) {
          groupedByClass = groupedByClass.map(([classId, classStandings]) => [
            classId,
            classStandings
              .slice()
              .sort(
                (a, b) => (a.classPosition ?? 999) - (b.classPosition ?? 999)
              ),
          ]) as [string, typeof initialStandings][];
          if (excludedIdxs?.size) {
            groupedByClass = reRankClassPositions(groupedByClass);
          }
        }

        // Calculate position changes vs qualifying grid for race sessions
        const positionChangeAugmentedGroupedByClass =
          sessionType === 'Race'
            ? augmentStandingsWithPositionChange(
                groupedByClass,
                qualifyingResults
              )
            : groupedByClass;

        // Official race weekends retain the existing behavior. Practice estimates
        // are opt-in because they are hypothetical and do not affect iRating.
        const iratingAugmentedGroupedByClass = shouldCalculateIRatingChange(
          eventType,
          isOfficial,
          sessionType,
          settings?.iratingChange?.estimateInPractice ?? false
        )
          ? augmentStandingsWithIRating(positionChangeAugmentedGroupedByClass)
          : positionChangeAugmentedGroupedByClass;

        // Calculate gap to class leader when enabled OR when interval is enabled (interval needs gap data)
        const gapAugmentedGroupedByClass =
          gapEnabled || intervalEnabled
            ? augmentStandingsWithGap(
                iratingAugmentedGroupedByClass,
                carIdxLap,
                carIdxLapDistPct,
                carIdxOnPitRoad,
                carIdxEstTime,
                useLivePositionStandings,
                sessionType
              )
            : iratingAugmentedGroupedByClass;

        // Intervals always use class-leader gaps, regardless of displayed reference.
        const intervalAugmentedGroupedByClass = intervalEnabled
          ? augmentStandingsWithInterval(
              gapAugmentedGroupedByClass,
              carIdxLap,
              carIdxLapDistPct,
              intervalDisplayMode === 'laps'
            )
          : gapAugmentedGroupedByClass;

        const displayedStandings =
          gapEnabled && gapReference === 'player'
            ? perfMetrics.measure('standingsPlayerGaps', () =>
                augmentStandingsWithPlayerGap(
                  intervalAugmentedGroupedByClass,
                  carIdxLap,
                  carIdxLapDistPct,
                  carIdxOnPitRoad,
                  carIdxEstTime,
                  sessionType
                )
              )
            : intervalAugmentedGroupedByClass;

        const finalStandings =
          sessionType === 'Race' &&
          sessionState >= SessionState.Checkered &&
          finalRaceTiming?.length &&
          (gapEnabled || intervalEnabled)
            ? perfMetrics.measure('standingsFinalTiming', () =>
                augmentStandingsWithFinalTiming(
                  displayedStandings,
                  finalRaceTiming,
                  {
                    gap: gapEnabled ?? false,
                    interval: intervalEnabled ?? false,
                    showLapDifferences: intervalDisplayMode === 'laps',
                    playerReference: gapReference === 'player',
                  }
                )
              )
            : displayedStandings;

        if (options?.showAll) return { groups: finalStandings, excluded };
        return {
          groups: sliceRelevantDrivers(finalStandings, driverClass, {
            buffer,
            numNonClassDrivers,
            minPlayerClassDrivers,
            numTopDrivers,
          }),
          excluded,
        };
      }),
    [
      driverCarIdx,
      sessionDrivers,
      qualifyingResults,
      allQualifyingResults,
      excludedIdxs,
      resultsPositions,
      carIdxLastLapTime,
      carIdxBestLapTime,
      carIdxF2Time,
      carIdxOnPitRoad,
      carIdxTrackSurface,
      radioTransmitCarIdx,
      carIdxTireCompound,
      carIdxSessionFlags,
      carIdxWheelCompounds,
      carIdxTrackLimitsPoints,
      carIdxEnergyRemaining,
      carIdxPenalties,
      carIdxPenaltyKind,
      carIdxPenaltySeconds,
      carIdxFinishStatus,
      penaltySeconds,
      ownCarIdx,
      positions,
      fastestLaps,
      sessionType,
      sessionState,
      finalRaceTiming,
      lastPitLap,
      lastLap,
      prevCarTrackSurface,
      lapTimeDeltasEnabled,
      numLapDeltas,
      lapDeltasForCalc,
      useLivePositionStandings,
      isOfficial,
      eventType,
      settings?.iratingChange?.estimateInPractice,
      gapEnabled,
      gapReference,
      intervalEnabled,
      intervalDisplayMode,
      carIdxLap,
      carIdxLapDistPct,
      carIdxEstTime,
      driverClass,
      buffer,
      numNonClassDrivers,
      minPlayerClassDrivers,
      numTopDrivers,
      driverLivePositions,
      options?.showAll,
      customClassOrdering,
    ]
  );

  return standingsWithGain;
};

/**
 * Compute lap time deltas by aligning each car's Nth-most-recent lap against
 * the focus car's Nth-most-recent lap. This ensures:
 *   - Deltas don't jump when either car crosses start/finish
 *   - Pit laps only affect the one column where the pit occurred
 *   - Works when cars are on different laps (e.g. player lapped)
 */
export const calculateLapDeltas = (
  lapTimeHistory: number[][],
  focusCarIdx: number | undefined,
  enabled: boolean
): number[][] | undefined => {
  if (!enabled || focusCarIdx === undefined) return undefined;
  const focusHistory = lapTimeHistory[focusCarIdx];
  if (!focusHistory || focusHistory.length === 0) return undefined;

  return lapTimeHistory.map((carHistory, carIdx) => {
    if (carIdx === focusCarIdx || !carHistory || carHistory.length === 0)
      return [];

    const maxLaps = Math.min(carHistory.length, focusHistory.length);
    const deltas: number[] = [];
    for (let i = maxLaps; i >= 1; i--) {
      const carLap = carHistory[carHistory.length - i];
      const focusLap = focusHistory[focusHistory.length - i];
      if (focusLap && focusLap > 0) {
        deltas.push(carLap - focusLap);
      }
    }
    return deltas;
  });
};
