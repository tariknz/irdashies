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
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
  augmentStandingsWithIRating,
} from '../createStandings';

export const useDriverStandings = ({
  buffer,
  numNonClassDrivers,
  minPlayerClassDrivers,
  numTopDrivers,
}: {
  buffer?: number;
  numNonClassDrivers?: number;
  minPlayerClassDrivers?: number;
  numTopDrivers?: number;
} = {}) => {
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
  const isOfficial = useSessionIsOfficial();

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
      },
      {
        resultsPositions: positions,
        resultsFastestLap: fastestLaps,
        sessionType,
      }
    );
    const groupedByClass = groupStandingsByClass(initialStandings);
    const driverClass = sessionDrivers?.find(
      (driver) => driver.CarIdx === driverCarIdx
    )?.CarClassID;

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
  ]);

  return standingsWithGain;
};
