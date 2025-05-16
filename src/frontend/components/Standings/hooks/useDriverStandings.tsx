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
  Standings as DriverStandingInfo, // Renaming to avoid conflict if needed locally
} from '../createStandings';
import {
  calculateIRatingGain,
  RaceResult,
  CalculationResult,
} from '../../../utils/iratingGain';

export interface StandingsWithIRatingGain extends DriverStandingInfo {
  iratingChange?: number;
}

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

    const augmentedGroupedByClass: [string, StandingsWithIRatingGain[]][] = groupedByClass.map(
      ([classId, classStandings]) => {
        const raceResultsInput: RaceResult<number>[] = classStandings.map(
          (driverStanding) => ({
            driver: driverStanding.carIdx,
            finishRank: driverStanding.classPosition,
            startIRating: driverStanding.driver.rating,
            started: true, // This is a critical assumption.
          }),
        );

        if (raceResultsInput.length === 0) {
          return [classId, classStandings as StandingsWithIRatingGain[]];
        }

        const iratingCalculationResults = calculateIRatingGain(raceResultsInput);

        const iratingChangeMap = new Map<number, number>();
        iratingCalculationResults.forEach((calcResult: CalculationResult<number>) => {
          iratingChangeMap.set(
            calcResult.raceResult.driver,
            calcResult.iratingChange,
          );
        });

        const augmentedClassStandings: StandingsWithIRatingGain[] = classStandings.map(
          (driverStanding) => ({
            ...driverStanding,
            iratingChange: iratingChangeMap.get(driverStanding.carIdx),
          }),
        );
        return [classId, augmentedClassStandings];
      },
    );

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
