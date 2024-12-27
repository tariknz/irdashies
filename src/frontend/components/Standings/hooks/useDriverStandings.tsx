import { useMemo } from 'react';
import { useSession, useTelemetry } from '@irdashies/context';
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
} from '../createStandings';
import { useCurrentSession } from './useCurrentSession';

export const useDriverStandings = ({ buffer }: { buffer: number }) => {
  const { session } = useSession();
  const currentSession = useCurrentSession();
  const carIdxF2Time = useTelemetry('CarIdxF2Time');
  const carIdxOnPitRoad = useTelemetry<boolean[]>('CarIdxOnPitRoad');
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const radioTransmitCarIdx = useTelemetry('RadioTransmitCarIdx');

  const standings = useMemo(() => {
    const standings = createDriverStandings(
      {
        playerIdx: session?.DriverInfo?.DriverCarIdx,
        drivers: session?.DriverInfo?.Drivers,
        qualifyingResults: session?.QualifyResultsInfo?.Results,
      },
      {
        carIdxF2TimeValue: carIdxF2Time?.value,
        carIdxOnPitRoadValue: carIdxOnPitRoad?.value,
        carIdxTrackSurfaceValue: carIdxTrackSurface?.value,
        radioTransmitCarIdx: radioTransmitCarIdx?.value,
      },
      {
        resultsPositions: currentSession?.ResultsPositions,
        resultsFastestLap: currentSession?.ResultsFastestLap,
        sessionType: currentSession?.SessionType,
      }
    );
    const grouped = groupStandingsByClass(standings);
    return sliceRelevantDrivers(grouped, { buffer });
  }, [
    session?.DriverInfo?.DriverCarIdx,
    session?.DriverInfo?.Drivers,
    session?.QualifyResultsInfo?.Results,
    carIdxF2Time?.value,
    carIdxOnPitRoad?.value,
    carIdxTrackSurface?.value,
    radioTransmitCarIdx?.value,
    currentSession?.ResultsPositions,
    currentSession?.ResultsFastestLap,
    currentSession?.SessionType,
    buffer,
  ]);

  return standings;
};
