import { useMemo } from 'react';
import { useSession, useTelemetry } from '../../../context/TelemetryContext';
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
} from '../createStandings';
import { useCurrentSession } from './useCurrentSession';

export const useDriverStandings = ({ buffer }: { buffer: number }) => {
  const { telemetry } = useTelemetry();
  const { session } = useSession();
  const currentSession = useCurrentSession();

  const standings = useMemo(() => {
    const standings = createDriverStandings(
      {
        playerIdx: session?.DriverInfo?.DriverCarIdx,
        drivers: session?.DriverInfo?.Drivers,
        qualifyingResults: session?.QualifyResultsInfo?.Results,
      },
      {
        carIdxF2TimeValue: telemetry?.CarIdxF2Time?.value,
        carIdxOnPitRoadValue: telemetry?.CarIdxOnPitRoad?.value,
        carIdxTrackSurfaceValue: telemetry?.CarIdxTrackSurface?.value,
        radioTransmitCarIdx: telemetry?.RadioTransmitCarIdx?.value,
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
    telemetry?.CarIdxF2Time?.value,
    telemetry?.CarIdxOnPitRoad?.value,
    telemetry?.CarIdxTrackSurface?.value,
    telemetry?.RadioTransmitCarIdx?.value,
    currentSession?.ResultsPositions,
    currentSession?.ResultsFastestLap,
    currentSession?.SessionType,
    buffer,
  ]);

  return standings;
};
