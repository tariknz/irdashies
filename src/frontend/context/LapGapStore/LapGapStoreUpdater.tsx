import { memo, useEffect, useMemo, useRef } from 'react';
import { useLapGapStore } from './LapGapStore';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useSessionLifecycle } from '../ChannelStore/useSessionLifecycle';
import {
  standingsSelectors,
  useStandingsSelector,
} from '../ChannelStore/useStandingsSnapshot';

interface LapGapStoreUpdaterProps {
  /**
   * Gates the standings subscription so an idle Gantry window does not keep
   * the standings processor alive. Nothing is lost while disconnected - there
   * are no laps to record.
   */
  enabled?: boolean;
}

// useDriverStandings returns [classId, Standings[]][] — an array of [classId, drivers] tuples.
// Standings.gap is { value?: number, laps: number }. Use .value for the seconds gap.
const ActiveLapGapStoreUpdater = memo(() => {
  const carIdxLap = useStandingsSelector(standingsSelectors.carIdxLap);
  const sessionNum = useStandingsSelector(standingsSelectors.sessionNum);
  const prevLapsRef = useRef<number[]>([]);
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  const setSessionNum = useLapGapStore((s) => s.setSessionNum);
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
  useEffect(() => {
    allDriversRef.current = allDrivers;
  }, [allDrivers]);

  // Unlike the lifecycle event channel, standings snapshots resume with the
  // current SessionNum after a hidden window becomes visible. Keeping that
  // identity in the store makes a missed Qualifying -> Race transition reset
  // durable across updater unmounts as well.
  useEffect(() => {
    if (sessionNum === undefined || sessionNum === null) return;
    const previousSessionNum = useLapGapStore.getState().sessionNum;
    setSessionNum(sessionNum);
    if (previousSessionNum !== null && previousSessionNum !== sessionNum) {
      prevLapsRef.current = [];
    }
  }, [sessionNum, setSessionNum]);

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
ActiveLapGapStoreUpdater.displayName = 'ActiveLapGapStoreUpdater';

export const LapGapStoreUpdater = memo(
  ({ enabled = true }: LapGapStoreUpdaterProps) =>
    enabled ? <ActiveLapGapStoreUpdater /> : null
);
LapGapStoreUpdater.displayName = 'LapGapStoreUpdater';
