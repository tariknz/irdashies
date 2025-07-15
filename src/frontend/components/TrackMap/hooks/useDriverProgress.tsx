import { useMemo, useRef, useEffect, useState } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValuesMapped,
  useSessionStore,
} from '@irdashies/context';

// Throttle updates to reduce processing load
const UPDATE_THROTTLE_MS = 50; // 20fps instead of 60fps

export const useDriverProgress = () => {
  const driverIdx = useDriverCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValuesMapped<number[]>(
    'CarIdxLapDistPct',
    (val) => Math.round(val * 1000) / 1000 // Reduce precision to 2 decimal places to minimize unnecessary updates
  );
  const paceCarIdx = useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  // Throttled state to reduce update frequency
  const [throttledLapDist, setThrottledLapDist] = useState<number[]>([]);
  const lastUpdateRef = useRef<number>(0);

  // Throttle the lap distance updates
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= UPDATE_THROTTLE_MS) {
      setThrottledLapDist(driversLapDist || []);
      lastUpdateRef.current = now;
    }
  }, [driversLapDist]);

  const driversTrackData = useMemo(() => {
    if (!drivers || !throttledLapDist.length) return [];

    return drivers
      .map((driver) => ({
        driver: driver,
        progress: throttledLapDist[driver.CarIdx] ?? -1,
        isPlayer: driver.CarIdx === driverIdx,
      }))
      .filter((d) => d.progress > -1) // ignore drivers not on track
      .filter((d) => d.driver.CarIdx > -1 && d.driver.CarIdx !== paceCarIdx); // ignore pace car
  }, [drivers, throttledLapDist, driverIdx, paceCarIdx]);

  return driversTrackData;
};
