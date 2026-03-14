import { useMemo } from 'react';
import {
  useSessionDrivers,
  useSessionFastestLaps,
  useSessionIsOfficial,
  useSessionPositions,
  useSessionQualifyingResults,
  useSessionQualifyPositions,
  useSessionType,
  useTelemetryValue,
  useFocusCarIdx,
  useTelemetryValues,
  useTelemetryValuesRounded,
  useCarLap,
  usePitLap,
  usePrevCarTrackSurface,
  useLapTimeHistory,
} from '@irdashies/context';
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
  augmentStandingsWithIRating,
  augmentStandingsWithGap,
  augmentStandingsWithInterval,
  augmentStandingsWithPositionChange,
} from '../createStandings';
import type { StandingsWidgetSettings } from '@irdashies/types';
import { useDriverLivePositions } from './useDriverLivePositions';
import { useStandingsSettings } from './useStandingsSettings';
import { TrackLocation } from '@irdashies/types';
import type { SessionResults } from '@irdashies/types';

export const useDriverStandings = (
  settings?: StandingsWidgetSettings['config']
) => {
  const {
    driverStandings: {
      buffer,
      numNonClassDrivers,
      minPlayerClassDrivers,
      numTopDrivers,
    } = {},
    gap: { enabled: gapEnabled } = { enabled: false },
    interval: { enabled: intervalEnabled } = { enabled: false },
    lapTimeDeltas: { enabled: lapTimeDeltasEnabled, numLaps: numLapDeltas } = {
      enabled: false,
      numLaps: 3,
    },
  } = settings ?? {};

  const sessionDrivers = useSessionDrivers();
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const driverCarIdx = useFocusCarIdx();
  const qualifyingResultsRaw = useSessionQualifyingResults();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionType = useSessionType(sessionNum);
  const positions = useSessionPositions(sessionNum);
  const sessionQualifyPositions = useSessionQualifyPositions(sessionNum);

  // In heat race format QualifyResultsInfo.Results is null; fall back to the
  // race session's QualifyPositions which holds the actual starting grid order.
  const qualifyingResults: SessionResults[] | undefined =
    qualifyingResultsRaw?.length
      ? qualifyingResultsRaw
      : sessionQualifyPositions?.map((q) => ({
          Position: q.Position + 1,
          ClassPosition: q.ClassPosition,
          CarIdx: q.CarIdx,
          Lap: q.FastestLap,
          Time: q.FastestTime,
          FastestLap: q.FastestLap,
          FastestTime: q.FastestTime,
          LastTime: -1,
          LapsLed: 0,
          LapsComplete: 0,
          JokerLapsComplete: 0,
          LapsDriven: 0,
          Incidents: 0,
          ReasonOutId: 0,
          ReasonOutStr: 'Running',
        }));
  const standingsSettings = useStandingsSettings();
  const useLivePositionStandings = standingsSettings?.useLivePosition ?? false;
  const driverLivePositions = useDriverLivePositions({
    enabled: useLivePositionStandings,
  });
  const fastestLaps = useSessionFastestLaps(sessionNum);
  const carIdxF2Time = useTelemetryValuesRounded('CarIdxF2Time', 2);
  const carIdxEstTime = useTelemetryValuesRounded('CarIdxEstTime', 2);
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');
  const carIdxLap = useTelemetryValues<number[]>('CarIdxLap');
  const carIdxLapDistPct = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
  const carIdxTrackSurface =
    useTelemetryValues<TrackLocation[]>('CarIdxTrackSurface');
  const radioTransmitCarIdx = useTelemetryValues<number[]>(
    'RadioTransmitCarIdx'
  );
  const carIdxTireCompound = useTelemetryValues<number[]>('CarIdxTireCompound');
  const carIdxSessionFlags = useTelemetryValues<number[]>('CarIdxSessionFlags');
  const isOfficial = useSessionIsOfficial();
  const lastPitLap = usePitLap();
  const lastLap = useCarLap();
  const prevCarTrackSurface = usePrevCarTrackSurface();
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

  const standingsWithGain = useMemo(() => {
    const initialStandings = createDriverStandings(
      {
        playerIdx: driverCarIdx,
        drivers: sessionDrivers,
        qualifyingResults: qualifyingResults,
      },
      {
        carIdxF2TimeValue: carIdxF2Time,
        carIdxOnPitRoadValue: carIdxOnPitRoad,
        carIdxTrackSurfaceValue: carIdxTrackSurface,
        radioTransmitCarIdx: radioTransmitCarIdx,
        carIdxTireCompoundValue: carIdxTireCompound,
        carIdxSessionFlags: carIdxSessionFlags,
      },
      {
        resultsPositions: positions,
        resultsFastestLap: fastestLaps,
        sessionType,
      },
      lastPitLap,
      lastLap,
      prevCarTrackSurface,
      lapTimeDeltasEnabled ? numLapDeltas : undefined,
      lapDeltasForCalc
    );

    if (useLivePositionStandings) {
      // Apply live positions as per-class positions, then sort class arrays by class position
      initialStandings.forEach((standing) => {
        const livePosition = driverLivePositions[standing.carIdx];
        if (livePosition !== undefined) standing.classPosition = livePosition;
      });
    }

    // Group and *sort drivers inside each class by classPosition* (this respects live positions)
    let groupedByClass = groupStandingsByClass(initialStandings);
    if (useLivePositionStandings) {
      groupedByClass = groupedByClass.map(([classId, classStandings]) => [
        classId,
        classStandings
          .slice()
          .sort((a, b) => (a.classPosition ?? 999) - (b.classPosition ?? 999)),
      ]) as [string, typeof initialStandings][];
    }

    // Calculate position changes vs qualifying grid for race sessions
    const positionChangeAugmentedGroupedByClass =
      sessionType === 'Race'
        ? augmentStandingsWithPositionChange(groupedByClass, qualifyingResults)
        : groupedByClass;

    // Calculate iRating changes for race sessions
    const iratingAugmentedGroupedByClass =
      sessionType === 'Race' && isOfficial
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
            useLivePositionStandings
          )
        : iratingAugmentedGroupedByClass;

    // Calculate interval to player when enabled
    const intervalAugmentedGroupedByClass = intervalEnabled
      ? augmentStandingsWithInterval(gapAugmentedGroupedByClass)
      : gapAugmentedGroupedByClass;

    return sliceRelevantDrivers(intervalAugmentedGroupedByClass, driverClass, {
      buffer,
      numNonClassDrivers,
      minPlayerClassDrivers,
      numTopDrivers,
    });
  }, [
    driverCarIdx,
    sessionDrivers,
    qualifyingResults,
    carIdxF2Time,
    carIdxOnPitRoad,
    carIdxTrackSurface,
    radioTransmitCarIdx,
    carIdxTireCompound,
    carIdxSessionFlags,
    positions,
    fastestLaps,
    sessionType,
    lastPitLap,
    lastLap,
    prevCarTrackSurface,
    lapTimeDeltasEnabled,
    numLapDeltas,
    lapDeltasForCalc,
    useLivePositionStandings,
    isOfficial,
    gapEnabled,
    intervalEnabled,
    carIdxLap,
    carIdxLapDistPct,
    carIdxEstTime,
    driverClass,
    buffer,
    numNonClassDrivers,
    minPlayerClassDrivers,
    numTopDrivers,
    driverLivePositions,
  ]);

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
