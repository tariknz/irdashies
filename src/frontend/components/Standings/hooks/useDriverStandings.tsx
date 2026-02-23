import { useMemo } from 'react';
import {
  useSessionDrivers,
  useSessionFastestLaps,
  useSessionIsOfficial,
  useSessionPositions,
  useSessionQualifyingResults,
  useSessionType,
  useTelemetry,
  useTelemetryValue,
  useFocusCarIdx,
  useTelemetryValues,
} from '@irdashies/context';
import { useLapTimeHistory } from '../../../context/LapTimesStore/LapTimesStore';
import {
  useCarLap,
  usePitLap,
  usePrevCarTrackSurface,
} from '@irdashies/context';
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
  augmentStandingsWithIRating,
  augmentStandingsWithGap,
  // augmentStandingsWithInterval,
  augmentStandingsWithPositionChange,
} from '../createStandings';
import type { StandingsWidgetSettings } from '../../Settings/types';
import { useDriverLivePositions } from './useDriverLivePositions';
import { useStandingsSettings } from './useStandingsSettings';

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
  const qualifyingResults = useSessionQualifyingResults();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionType = useSessionType(sessionNum);
  const positions = useSessionPositions(sessionNum);
  const standingsSettings = useStandingsSettings();
  const useLivePositionStandings = standingsSettings?.useLivePosition ?? false;
  const driverLivePositions = useDriverLivePositions({
    enabled: useLivePositionStandings,
  });
  const fastestLaps = useSessionFastestLaps(sessionNum);
  const carIdxF2Time = useTelemetryValues<number[]>('CarIdxF2Time');
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const radioTransmitCarIdx = useTelemetry('RadioTransmitCarIdx');
  const carIdxTireCompound = useTelemetry<number[]>('CarIdxTireCompound');
  const carIdxSessionFlags = useTelemetry<number[]>('CarIdxSessionFlags');
  const isOfficial = useSessionIsOfficial();
  const lastPitLap = usePitLap();
  const lastLap = useCarLap();
  const prevCarTrackSurface = usePrevCarTrackSurface();
  const driverClass = useMemo(() => {
    return sessionDrivers?.find((driver) => driver.CarIdx === driverCarIdx)
      ?.CarClassID;
  }, [sessionDrivers, driverCarIdx]);
  const lapTimeHistory = useLapTimeHistory();

  // Compute deltas at read time against the current focus car (driverCarIdx).
  // This means switching spectated car instantly updates deltas without any
  // history reset, since we just change the reference car.
  const lapDeltasForCalc = useMemo(() => {
    if (!lapTimeDeltasEnabled || driverCarIdx === undefined) return undefined;
    const focusHistory = lapTimeHistory[driverCarIdx];
    if (!focusHistory || focusHistory.length === 0) return undefined;

    // Use the most recent focus car lap as the reference for all comparisons.
    // This is the fairest available comparison regardless of when each car
    // completed their laps.
    const focusLapTime = focusHistory[focusHistory.length - 1];
    if (!focusLapTime || focusLapTime <= 0) return undefined;

    return lapTimeHistory.map((carHistory, carIdx) => {
      if (carIdx === driverCarIdx || !carHistory || carHistory.length === 0)
        return [];
      return carHistory.map((lapTime) => lapTime - focusLapTime);
    });
  }, [lapTimeDeltasEnabled, lapTimeHistory, driverCarIdx]);

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
        carIdxTrackSurfaceValue: carIdxTrackSurface?.value,
        radioTransmitCarIdx: radioTransmitCarIdx?.value,
        carIdxTireCompoundValue: carIdxTireCompound?.value,
        carIdxSessionFlags: carIdxSessionFlags?.value,
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
            carIdxF2Time,
            carIdxLapDistPct,
            carIdxOnPitRoad
          )
        : iratingAugmentedGroupedByClass;

    // Calculate interval to player when enabled
    // const intervalAugmentedGroupedByClass = intervalEnabled
    //   ? augmentStandingsWithInterval(gapAugmentedGroupedByClass)
    //   : gapAugmentedGroupedByClass;

    return sliceRelevantDrivers(gapAugmentedGroupedByClass, driverClass, {
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
    carIdxTrackSurface?.value,
    radioTransmitCarIdx?.value,
    carIdxTireCompound?.value,
    carIdxSessionFlags?.value,
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
    carIdxLapDistPct,
    driverClass,
    buffer,
    numNonClassDrivers,
    minPlayerClassDrivers,
    numTopDrivers,
    driverLivePositions,
  ]);

  return standingsWithGain;
};
