import { useMemo } from 'react';
import {
  useFocusCarIdx,
  useSessionDrivers,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';

// Drivers progress logic
export const useDriverProgress = () => {
  const driverIdx = useFocusCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  // Get class position data from telemetry
  const carIdxClassPosition = useTelemetryValues<number[]>(
    'CarIdxClassPosition'
  );

  const driversTrackData = useMemo(() => {
    if (!drivers || !driversLapDist.length) return [];

    // Compute fallback positions using ALL drivers (not just on-track) so that
    // a driver in the pits still holds their standings position and on-track
    // drivers behind them get the correct number.
    const allParticipants = drivers.filter(
      (d) => !d.CarIsPaceCar && !d.IsSpectator && d.CarIdx !== paceCarIdx
    );
    const byClass: Record<string, typeof allParticipants> = {};
    for (const d of allParticipants) {
      if (!byClass[d.CarClassID]) byClass[d.CarClassID] = [];
      byClass[d.CarClassID].push(d);
    }
    // Build carIdx -> effective class position map
    const effectivePosition: Record<number, number> = {};
    for (const classDrivers of Object.values(byClass)) {
      const numRanked = classDrivers.filter(
        (d) => (carIdxClassPosition?.[d.CarIdx] ?? 0) > 0
      ).length;
      const unranked = classDrivers
        .filter((d) => (carIdxClassPosition?.[d.CarIdx] ?? 0) <= 0)
        .sort((a, b) =>
          a.CarNumber.localeCompare(b.CarNumber, undefined, { numeric: true })
        );
      unranked.forEach((d, index) => {
        effectivePosition[d.CarIdx] = numRanked + index + 1;
      });
    }

    return drivers
      .map((driver) => ({
        driver: driver,
        progress: driversLapDist[driver.CarIdx] ?? -1,
        isPlayer: driver.CarIdx === driverIdx,
        classPosition:
          (carIdxClassPosition?.[driver.CarIdx] ?? 0) > 0
            ? carIdxClassPosition?.[driver.CarIdx]
            : effectivePosition[driver.CarIdx],
      }))
      .filter((d) => d.progress > -1) // ignore drivers not on track
      .filter((d) => d.driver.CarIdx !== paceCarIdx); // ignore pace car
  }, [drivers, driversLapDist, driverIdx, paceCarIdx, carIdxClassPosition]);

  return driversTrackData;
};
