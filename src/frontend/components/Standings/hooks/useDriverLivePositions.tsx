import { useMemo } from 'react';
import { useSessionStore, useTelemetryValues } from '@irdashies/context';

/**
 * Hook that returns a dictionary with driver index and live position.
 * Live position is calculated using CarIdxLapCompleted plus CarIdxLapDistPct
 * from telemetry, then sorted to return integer positions starting from 1.
 * Positions are relative to the driver's class.
 *
 * @returns Record<driverId, position> where position is an integer relative to the driver's class
 */
export const useDriverLivePositions = (): Record<number, number> => {
  const carIdxLapCompleted = useTelemetryValues<number[]>('CarIdxLapCompleted');
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const CarIdxClass = useTelemetryValues<number[]>('CarIdxClass');
  const paceCarIdx =
      useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  return useMemo(() => {
    // Group drivers by class
    const driversByClass = new Map<number, { driverIdx: number; progress: number }[]>();

    // Calculate live position progress for each driver (excluding pace car)
    if (carIdxLapCompleted.length > 0 && carIdxLapDistPct.length > 0 && CarIdxClass.length > 0) {
      carIdxLapCompleted.forEach((lapCompleted, driverIdx) => {
        // Skip the pace car
        if (driverIdx === paceCarIdx) return;

        const classId = CarIdxClass[driverIdx] ?? -1;
        const distPct = carIdxLapDistPct[driverIdx] ?? 0;
        
        // Live position combines completed laps with current lap progress
        const driverData = {
          driverIdx,
          progress: lapCompleted + distPct,
        };

        const classDrivers = driversByClass.get(classId) ?? [];
        classDrivers.push(driverData);
        driversByClass.set(classId, classDrivers);
      });
    }

    // Sort drivers within each class by progress and assign positions
    const livePositions: Record<number, number> = {};
    driversByClass.forEach((drivers) => {
      // Sort by progress (highest progress = best position)
      drivers.sort((a, b) => b.progress - a.progress);
      
      // Assign positions within the class starting from 1
      drivers.forEach((driver, index) => {
        livePositions[driver.driverIdx] = index + 1;
      });
    });

    return livePositions;
  }, [carIdxLapCompleted, carIdxLapDistPct, CarIdxClass, paceCarIdx]);
};
