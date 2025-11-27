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
  augmentStandingsWithInterval,
} from '../createStandings';
import type { StandingsWidgetSettings } from '../../Settings/types';

export const useDriverStandings = (settings?: StandingsWidgetSettings['config']) => {
  const {
    driverStandings: {
      buffer,
      numNonClassDrivers,
      minPlayerClassDrivers,
      numTopDrivers,
    } = {},
    gap: { enabled: gapEnabled } = { enabled: false },
    interval: { enabled: intervalEnabled } = { enabled: false },
    lapTimeDeltas: { enabled: lapTimeDeltasEnabled, numLaps: numLapDeltas } = { enabled: false, numLaps: 3 },
  } = settings ?? {};

  const sessionDrivers = useSessionDrivers();
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const driverCarIdx = useFocusCarIdx();
  const qualifyingResults = useSessionQualifyingResults();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionType = useSessionType(sessionNum);
  const positions = useSessionPositions(sessionNum);
  const fastestLaps = useSessionFastestLaps(sessionNum);
  const carIdxF2Time = useTelemetry('CarIdxF2Time');
  const carIdxOnPitRoad = useTelemetry<boolean[]>('CarIdxOnPitRoad');
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const radioTransmitCarIdx = useTelemetry('RadioTransmitCarIdx');
  const carIdxTireCompound = useTelemetry<number[]>('CarIdxTireCompound');
  const carIdxSessionFlags = useTelemetry<number[]>('CarIdxSessionFlags');
  const isOfficial = useSessionIsOfficial();
  const lastPitLap = usePitLap();
  const lastLap = useCarLap();
  const prevCarTrackSurface = usePrevCarTrackSurface();
  const driverClass = useMemo(() => {
    return sessionDrivers?.find(
      (driver) => driver.CarIdx === driverCarIdx
    )?.CarClassID;
  }, [sessionDrivers, driverCarIdx]);
  const lapTimeHistory = useLapTimeHistory();

  // Note: gap and interval calculations are now purely delta-based, no telemetry needed

  // Only pass lap history when feature is enabled to avoid unnecessary calculations
  const lapTimeHistoryForCalc = lapTimeDeltasEnabled ? lapTimeHistory : undefined;

  const standingsWithGain = useMemo(() => {
    const initialStandings = createDriverStandings(
      {
        playerIdx: driverCarIdx,
        drivers: sessionDrivers,
        qualifyingResults: qualifyingResults,
      },
      {
        carIdxF2TimeValue: carIdxF2Time?.value,
        carIdxOnPitRoadValue: carIdxOnPitRoad?.value,
        carIdxTrackSurfaceValue: carIdxTrackSurface?.value,
        radioTransmitCarIdx: radioTransmitCarIdx?.value,
        carIdxTireCompoundValue: carIdxTireCompound?.value,
        carIdxSessionFlags: carIdxSessionFlags?.value
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
      lapTimeHistoryForCalc,
    );
    const groupedByClass = groupStandingsByClass(initialStandings);

    // Calculate iRating changes for race sessions
    const iratingAugmentedGroupedByClass =
      sessionType === 'Race' && isOfficial
        ? augmentStandingsWithIRating(groupedByClass)
        : groupedByClass;

    // Calculate gap to class leader when enabled OR when interval is enabled (interval needs gap data)
    const gapAugmentedGroupedByClass = gapEnabled || intervalEnabled
      ? augmentStandingsWithGap(iratingAugmentedGroupedByClass)
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
    carIdxF2Time?.value,
    carIdxOnPitRoad?.value,
    carIdxTrackSurface?.value,
    radioTransmitCarIdx?.value,
    positions,
    fastestLaps,
    sessionType,
    isOfficial,
    buffer,
    numNonClassDrivers,
    minPlayerClassDrivers,
    numTopDrivers,
    carIdxTireCompound?.value,
    driverClass,
    lapTimeDeltasEnabled,
    numLapDeltas,
    lapTimeHistoryForCalc,
    lastLap,
    lastPitLap,
    prevCarTrackSurface,
    gapEnabled,
    intervalEnabled,
    carIdxSessionFlags?.value
  ]);

  return standingsWithGain;
};
