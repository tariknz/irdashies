import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useSessionFastestLaps,
  useSessionIsOfficial,
  useSessionPositions,
  useSessionQualifyingResults,
  useSessionType,
  useTelemetry,
  useTelemetryValue,
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
    lapTimeDeltas: { enabled: lapTimeDeltasEnabled, numLaps: numLapDeltas } = { enabled: false, numLaps: 3 },
  } = settings ?? {};

  const sessionDrivers = useSessionDrivers();
  const driverCarIdx = useDriverCarIdx();
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
  const isOfficial = useSessionIsOfficial();
  const lastPitLap = usePitLap();
  const lastLap = useCarLap();
  const prevCarTrackSurface = usePrevCarTrackSurface();
  const onTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const driverClass = useMemo(() => {
    return sessionDrivers?.find(
      (driver) => driver.CarIdx === driverCarIdx
    )?.CarClassID;
  }, [sessionDrivers, driverCarIdx]);
  const lapTimeHistory = useLapTimeHistory();

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
      },
      {
        resultsPositions: positions,
        resultsFastestLap: fastestLaps,
        sessionType,
      },
      lapTimeHistoryForCalc,
      lapTimeDeltasEnabled ? numLapDeltas : undefined,
      lastPitLap,
      lastLap,
      onTrack,
      prevCarTrackSurface,
    );
    const groupedByClass = groupStandingsByClass(initialStandings);

    // Calculate iRating changes for race sessions
    const augmentedGroupedByClass =
      sessionType === 'Race' && isOfficial
        ? augmentStandingsWithIRating(groupedByClass)
        : groupedByClass;

    return sliceRelevantDrivers(augmentedGroupedByClass, driverClass, {
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
  ]);

  return standingsWithGain;
};
