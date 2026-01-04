import { useMemo } from 'react';
import { useCurrentSessionType, useSessionStore, useTelemetryValue, useTelemetryValues } from '@irdashies/context';
import { GlobalFlags } from '@irdashies/types';

/**
 * Hook that returns a dictionary with driver index and live position.
 * Live position is calculated using CarIdxLapCompleted plus CarIdxLapDistPct
 * from telemetry, then sorted to return integer positions starting from 1.
 * Positions are relative to the driver's class.
 *
 * @returns Record<driverId, position> where position is an integer relative to the driver's class
 */
export const useDriverLivePositions = (): Record<number, number> => {
  const sessionType = useCurrentSessionType();
  const sessionState = useTelemetryValue('SessionState') ?? 0;
  const carIdxLapCompleted = useTelemetryValues<number[]>('CarIdxLapCompleted');
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const carIdxClassPosition = useTelemetryValues<number[]>('CarIdxClass');
  const carIdxPosition = useTelemetryValues<number[]>('CarIdxClassPosition');
  const carIdxSessionFlags = useTelemetryValues<number[]>('CarIdxSessionFlags');
  const paceCarIdx =
      useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  return useMemo(() => {
    // Group drivers by class
    const driversByClass = new Map<number, { driverIdx: number; progress: number, lapCompleted: number, iRacingPosition: number, checkered: boolean }[]>();
    // Calculate live position progress for each driver (excluding pace car)
    if (carIdxLapCompleted.length > 0 && carIdxLapDistPct.length > 0 && carIdxClassPosition.length > 0) {
      carIdxLapCompleted.forEach((lapCompleted, driverIdx) => {
        // Skip the pace car
        if (driverIdx === paceCarIdx) return;

        const classId = carIdxClassPosition[driverIdx] ?? -1;
        const distPct = carIdxLapDistPct[driverIdx] ?? 0;
        
        // Live position combines completed laps with current lap progress
        const driverData = {
          driverIdx,
          progress: lapCompleted + distPct,
          lapCompleted,
          iRacingPosition: carIdxPosition[driverIdx] ?? -1,
          checkered: !!((carIdxSessionFlags[driverIdx] ?? 0) & GlobalFlags.Checkered),
        };

        const classDrivers = driversByClass.get(classId) ?? [];
        classDrivers.push(driverData);
        driversByClass.set(classId, classDrivers);
      });
    }

    // Sort drivers within each class by progress and assign positions
    const livePositions: Record<number, number> = {};
    driversByClass.forEach((drivers) => {
      // Fall back to iRacing position if one of these conditions are met
      if(sessionType !== 'Race' /* Ignore practice/quali/warmup */ || 
        Math.max(...carIdxLapCompleted) < 1 /* Ignore the first lap */ || 
        sessionState === 6 /* Check if session is checkered */) {
        // Sort by iRacing position
        drivers.sort((a, b) => a.iRacingPosition - b.iRacingPosition);
      }else{
        // Sort by progress (highest progress = best position)
        drivers.sort((a, b) => {
          if(a.checkered && !b.checkered) return 1;
          if(!a.checkered && b.checkered) return -1;
          if(a.checkered && b.checkered) return a.iRacingPosition - b.iRacingPosition;
          return b.progress - a.progress;
        });
      }
      
      // Assign positions within the class starting from 1
      drivers.forEach((driver, index) => {
        livePositions[driver.driverIdx] = index + 1;
      });
    });

    return livePositions;
  }, [sessionType, sessionState, carIdxLapCompleted, carIdxLapDistPct, carIdxClassPosition, carIdxPosition, carIdxSessionFlags, paceCarIdx]);
};
