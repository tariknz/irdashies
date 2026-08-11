import { memo, useEffect, useMemo, useRef } from 'react';
import { useLapGapStore } from './LapGapStore';
import { useDriverStandings } from '../../components/Standings/hooks/useDriverStandings';
import { useSessionLifecycle } from '../ChannelStore/useSessionLifecycle';
import {
  standingsSelectors,
  useStandingsSelector,
} from '../ChannelStore/useStandingsSnapshot';

// useDriverStandings returns [classId, Standings[]][] — an array of [classId, drivers] tuples.
// Standings.gap is { value?: number, laps: number }. Use .value for the seconds gap.
export const LapGapStoreUpdater = memo(() => {
  const carIdxLap = useStandingsSelector(standingsSelectors.carIdxLap);
  const prevLapsRef = useRef<number[]>([]);
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  // Pass gap enabled so the hook populates driver.gap, and showAll so every
  // car is returned instead of the buffer-sliced list around the player
  const standingsByClass = useDriverStandings(
    {
      gap: { enabled: true },
    } as Parameters<typeof useDriverStandings>[0],
    { showAll: true }
  );
  // Flatten all drivers from all classes into a single lookup
  const allDrivers = useMemo(
    () => standingsByClass.flatMap(([, classDrivers]) => classDrivers),
    [standingsByClass]
  );
  // Mirror latest standings in a ref to avoid stale closure in useEffect
  const allDriversRef = useRef(allDrivers);
  allDriversRef.current = allDrivers;

  useSessionLifecycle((event) => {
    if (event.type === 'sessionNumChange' || event.type === 'disconnect') {
      useLapGapStore.getState().reset();
      // prevLapsRef holds stale lap numbers from the old session; without
      // clearing it, new laps compare lower than the stale ones and no gaps
      // get recorded until cars pass their old lap count
      prevLapsRef.current = [];
    }
  });

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
  }, [carIdxLap, recordLapGap]);

  return null;
});
LapGapStoreUpdater.displayName = 'LapGapStoreUpdater';
