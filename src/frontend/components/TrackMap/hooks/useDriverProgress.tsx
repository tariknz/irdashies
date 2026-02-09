import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';

export const useDriverProgress = () => {
  const driverIdx = useDriverCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  // Get class position data from telemetry (this is class-specific position, not overall)
  const carIdxClassPosition = useTelemetryValues<number[]>(
    'CarIdxClassPosition'
  );

  const driversTrackData = useMemo(() => {
    if (!drivers || !driversLapDist.length) return [];

    return drivers
      .map((driver) => ({
        driver: driver,
        progress: driversLapDist[driver.CarIdx] ?? -1,
        isPlayer: driver.CarIdx === driverIdx,
        classPosition: carIdxClassPosition?.[driver.CarIdx],
      }))
      .filter((d) => d.progress > -1) // ignore drivers not on track
      .filter((d) => d.driver.CarIdx !== paceCarIdx); // ignore pace car
  }, [drivers, driversLapDist, driverIdx, paceCarIdx, carIdxClassPosition]);

  return driversTrackData;
};
