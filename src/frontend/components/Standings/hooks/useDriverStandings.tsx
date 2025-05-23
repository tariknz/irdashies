import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useSessionFastestLaps,
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

export const useDriverStandings = ({ buffer }: { buffer: number }) => {
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
    
    // Calculate iRating changes for race sessions
    const augmentedGroupedByClass = sessionType === 'Race' 
      ? augmentStandingsWithIRating(groupedByClass)
      : groupedByClass;

    return sliceRelevantDrivers(augmentedGroupedByClass, { buffer });
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
    buffer,
  ]);

  return standingsWithGain;
};
