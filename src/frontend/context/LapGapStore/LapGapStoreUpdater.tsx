import { memo, useEffect, useMemo, useRef } from 'react';
import { useTelemetryValuesRounded } from '../TelemetryStore/TelemetryStore';
import { useLapGapStore } from './LapGapStore';
import { useDriverStandings } from '../../components/Standings/hooks/useDriverStandings';

// useDriverStandings returns [classId, Standings[]][] — an array of [classId, drivers] tuples.
// Standings.gap is { value?: number, laps: number }. Use .value for the seconds gap.
export const LapGapStoreUpdater = memo(() => {
  const carIdxLap = useTelemetryValuesRounded('CarIdxLap', 0);
  const prevLapsRef = useRef<number[]>([]);
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  // Pass gap enabled so the hook populates driver.gap
  const standingsByClass = useDriverStandings({
    gap: { enabled: true },
  } as Parameters<typeof useDriverStandings>[0]);
  // Flatten all drivers from all classes into a single lookup
  const allDrivers = useMemo(
    () => standingsByClass.flatMap(([, classDrivers]) => classDrivers),
    [standingsByClass]
  );
  // Mirror latest standings in a ref to avoid stale closure in useEffect
  const allDriversRef = useRef(allDrivers);
  allDriversRef.current = allDrivers;

  useEffect(() => {
    if (!carIdxLap) return;
    carIdxLap.forEach((lap, carIdx) => {
      if (
        prevLapsRef.current[carIdx] !== undefined &&
        lap > prevLapsRef.current[carIdx]
      ) {
        // Lap just completed — record gap to class leader at the completed lap number
        const driver = allDriversRef.current.find((d) => d.carIdx === carIdx);
        if (driver) {
          recordLapGap(
            carIdx,
            prevLapsRef.current[carIdx],
            driver.gap?.value ?? 0
          );
        }
      }
    });
    prevLapsRef.current = [...carIdxLap];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carIdxLap]);

  return null;
});
LapGapStoreUpdater.displayName = 'LapGapStoreUpdater';
