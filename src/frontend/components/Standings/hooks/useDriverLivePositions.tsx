import { useMemo } from 'react';
import { useCurrentSessionType, useSessionStore, useTelemetryValue, useTelemetryValues, useSessionQualifyingResults } from '@irdashies/context';
import { GlobalFlags } from '@irdashies/types';

interface DriverData {
  driverIdx: number;
  progress: number;
  lapCompleted: number;
  iRacingPosition: number;
  qualifyPosition: number;
  checkered: boolean;
}

/**
* Hook that returns a dictionary with driver index and live position.
* Live position is calculated using CarIdxLapCompleted plus CarIdxLapDistPct
* from telemetry, then sorted to return integer positions starting from 1.
* Positions are relative to the driver's class.
*
* @returns Record<driverId, position> where position is an integer relative to the driver's class
*/
export const useDriverLivePositions = (): Record<number, number> => {
  const sessionQualifyingResults = useSessionQualifyingResults();
  const sessionType = useCurrentSessionType();
  const sessionState = useTelemetryValue('SessionState') ?? 0;
  const carIdxLapCompleted = useTelemetryValues<number[]>('CarIdxLapCompleted');
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const carIdxClass = useTelemetryValues<number[]>('CarIdxClass');
  const carIdxClassPosition = useTelemetryValues<number[]>('CarIdxClassPosition');
  const carIdxSessionFlags = useTelemetryValues<number[]>('CarIdxSessionFlags');
  const paceCarIdx = useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  // Memoize the qualifying results map separately to avoid recreating it 60 times per second
  const qualifyingResultsMap = useMemo(() =>
    new Map(sessionQualifyingResults?.map(result => [result.CarIdx, result]) ?? []),
    [sessionQualifyingResults]
  );

  return useMemo(() => {
    // To group drivers by class
    const driversByClass = new Map<number, DriverData[]>();

    // Ensure all necessary data is available
    if (carIdxLapCompleted.length > 0 && carIdxLapDistPct.length > 0 && carIdxClass.length > 0 && carIdxClassPosition.length > 0 && carIdxSessionFlags.length > 0) {

      // Use index-based iteration for better performance (60 FPS)
      carIdxLapCompleted.forEach((lapCompleted, driverIdx) => {

        // Skip the pace car
        if (driverIdx === paceCarIdx) return;

        // Collect necessary data
        const qualifyingResult = qualifyingResultsMap.get(driverIdx);
        const classId = carIdxClass[driverIdx] ?? -1;
        const distPct = carIdxLapDistPct[driverIdx] ?? 0;

        // Create driver data object
        const driverData = {
          driverIdx,
          progress: lapCompleted + distPct,
          lapCompleted,
          iRacingPosition: carIdxClassPosition[driverIdx] ?? -1,
          qualifyPosition: qualifyingResult ? qualifyingResult.ClassPosition + 1 : -1,
          checkered: !!((carIdxSessionFlags[driverIdx] ?? 0) & GlobalFlags.Checkered),
        };

        // Group drivers by their class
        const classDrivers = driversByClass.get(classId) ?? [];
        classDrivers.push(driverData);
        driversByClass.set(classId, classDrivers);
      });
    }

    // To hold the final live positions
    const livePositions: Record<number, number> = {};

    // Calculate live positions within each class
    driversByClass.forEach((drivers) => {

      if (sessionType !== 'Race' || // anything other than race
        sessionState === 6) // or race but checkered flag shown
      {
        drivers.sort((a, b) => {
          // treat positions <= 0 as unknown and put them at the end
          if (a.iRacingPosition <= 0 && b.iRacingPosition <= 0) return 0;
          if (a.iRacingPosition <= 0) return 1;
          if (b.iRacingPosition <= 0) return -1;
          // both have valid positions, use iRacingPosition to sort
          return a.iRacingPosition - b.iRacingPosition;
        });
      }
      else // race in progress
      {
        drivers.sort((a, b) => {
          // if LapCompleted -1, means before green, use qualifying position
          const aPositionToUse = a.lapCompleted < 0 ? a.qualifyPosition : a.iRacingPosition;
          const bPositionToUse = b.lapCompleted < 0 ? b.qualifyPosition : b.iRacingPosition;

          // treat positions <= 0 as unknown and put them at the end
          if (aPositionToUse <= 0 && bPositionToUse <= 0) return 0;
          if (aPositionToUse <= 0) return 1;
          if (bPositionToUse <= 0) return -1;

          // more laps completed ranks higher
          if (a.lapCompleted !== b.lapCompleted) return b.lapCompleted - a.lapCompleted;

          // from here on, both have completed same number of laps

          // lapCompleted = -1 | both on grid before green flag, use qualifying position
          if (a.lapCompleted < 0) {
            // treat positions <= 0 as unknown and put them at the end
            if (a.qualifyPosition <= 0 && b.qualifyPosition <= 0) return 0;
            if (a.qualifyPosition <= 0) return 1;
            if (b.qualifyPosition <= 0) return -1;
            return a.qualifyPosition - b.qualifyPosition;
          }

          // checkered flag beats non-checkered
          if (a.checkered && !b.checkered) return -1;
          if (!a.checkered && b.checkered) return 1;

          // both checkered, use iRacingPosition 
          if (a.checkered && b.checkered) {
            // treat positions <= 0 as unknown and put them at the end
            if (a.iRacingPosition <= 0 && b.iRacingPosition <= 0) return 0;
            if (a.iRacingPosition <= 0) return 1;
            if (b.iRacingPosition <= 0) return -1;
            return a.iRacingPosition - b.iRacingPosition;
          }

          // finally use progress for the rest
          return b.progress - a.progress;
        });
      }

      // Assign positions within the class starting from 1
      drivers.forEach((driver, index) => {
        livePositions[driver.driverIdx] = index + 1;
      });

    });

    return livePositions;
  }, [qualifyingResultsMap, sessionType, sessionState, carIdxLapCompleted, carIdxLapDistPct, carIdxClass, carIdxClassPosition, carIdxSessionFlags, paceCarIdx]);
};
