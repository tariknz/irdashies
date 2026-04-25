import { useMemo } from 'react';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { useReferenceLapStore } from '../ReferenceLapStore/ReferenceLapStore';
import { useSectorTimingStore } from '../SectorTimingStore/SectorTimingStore';
import { interpolateAtPoint } from '../../components/Standings/interpolation';

/**
 * Derives per-sector times from the persisted (ghost) reference lap for the
 * player's car class.  Returns the sector times and a flag indicating whether a
 * ghost file is actually loaded from disk.
 *
 * hasGhostLap is only true when initialize() found and loaded a saved ghost
 * file for the player's class. In-session laps promoted to persistedLaps are
 * NOT counted — use the ghost icon only for file-backed reference laps.
 *
 * Sector times are computed by interpolating the reference lap's
 * timeElapsedSinceStart at each sector-boundary trackPct, then diffing
 * adjacent boundary times.
 */
export const useReferenceLapSectorTimes = (): {
  refSectorTimes: (number | null)[];
  hasGhostLap: boolean;
} => {
  const playerCarIdx = useDriverCarIdx();

  const playerClassId = useSessionStore((s) => {
    const carIdx = s.session?.DriverInfo?.DriverCarIdx;
    const drivers = s.session?.DriverInfo?.Drivers;
    return drivers?.find((d) => d.CarIdx === carIdx)?.CarClassID ?? null;
  });

  const sectors = useSectorTimingStore((s) => s.sectors);

  // Subscribe so we recompute once persisted laps finish loading asynchronously.
  // seriesId is also included to clear the ghost row when a session resets.
  const seriesId = useReferenceLapStore((s) => s.seriesId);
  const persistedLapsVersion = useReferenceLapStore(
    (s) => s.persistedLapsVersion
  );

  // Only classes that had a ghost file loaded from disk — not in-session laps.
  const fileLoadedClassIds = useReferenceLapStore((s) => s.fileLoadedClassIds);

  return useMemo(() => {
    if (playerCarIdx == null || playerClassId == null || sectors.length === 0) {
      return { refSectorTimes: [], hasGhostLap: false };
    }

    // Only show ghost comparison when a file was explicitly loaded from disk.
    if (!fileLoadedClassIds.has(playerClassId)) {
      return { refSectorTimes: [], hasGhostLap: false };
    }

    const refLap = useReferenceLapStore
      .getState()
      .getReferenceLap(playerCarIdx, playerClassId, true);

    if (refLap.startTime < 0 || refLap.refPoints.size === 0) {
      return { refSectorTimes: [], hasGhostLap: false };
    }

    const lapTime = refLap.finishTime - refLap.startTime;
    if (lapTime <= 0) return { refSectorTimes: [], hasGhostLap: false };

    // Time elapsed at each sector's start boundary.
    // Sector 0 always begins at the S/F line (elapsed = 0).
    const timesAtBoundary: (number | null)[] = sectors.map((sector, i) => {
      if (i === 0) return 0;
      return interpolateAtPoint(refLap, sector.SectorStartPct);
    });

    const refSectorTimes: (number | null)[] = sectors.map((_, i) => {
      const start = timesAtBoundary[i];
      const end = i < sectors.length - 1 ? timesAtBoundary[i + 1] : lapTime;
      if (start === null || end === null) return null;
      return end - start;
    });

    return { refSectorTimes, hasGhostLap: true };
    // seriesId clears the ghost row when the session resets.
    // persistedLapsVersion increments after the async load in initialize()
    // completes, ensuring the memo re-runs once laps are actually available.
    // fileLoadedClassIds changes when initialize() finds a file lap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerCarIdx,
    playerClassId,
    sectors,
    seriesId,
    persistedLapsVersion,
    fileLoadedClassIds,
  ]);
};
