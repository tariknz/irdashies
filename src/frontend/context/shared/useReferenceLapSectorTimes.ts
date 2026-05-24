import { useMemo } from 'react';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { useReferenceLapStore } from '../ReferenceLapStore/ReferenceLapStore';
import { useSectorTimingStore } from '../SectorTimingStore/SectorTimingStore';
import { interpolateAtPoint } from '../../components/Standings/interpolation';

/**
 * Derives per-sector times from the persisted (ghost) reference lap for the
 * player's car class.  Returns the sector times and a flag indicating whether a
 * valid reference lap is available.
 *
 * hasReferenceLap is true when a valid reference lap (either loaded from disk
 * or created in-session) is available for comparison.
 *
 * Sector times are computed by interpolating the reference lap's
 * timeElapsedSinceStart at each sector-boundary trackPct, then diffing
 * adjacent boundary times.
 */
export const useReferenceLapSectorTimes = (): {
  refSectorTimes: (number | null)[];
  hasReferenceLap: boolean;
} => {
  const playerCarIdx = useDriverCarIdx();

  const playerClassId = useSessionStore((s) => {
    const carIdx = s.session?.DriverInfo?.DriverCarIdx;
    const drivers = s.session?.DriverInfo?.Drivers;
    return drivers?.find((d) => d.CarIdx === carIdx)?.CarClassID ?? null;
  });

  const sectors = useSectorTimingStore((s) => s.sectors);

  // Subscribe so we recompute once persisted laps finish loading asynchronously.
  // We use a selector for the lap itself so we re-run when the lap object
  // reference changes (e.g. after async load or in-session promotion).
  const refLap = useReferenceLapStore((s) =>
    playerCarIdx != null && playerClassId != null
      ? s.getReferenceLap(playerCarIdx, playerClassId, true)
      : null
  );

  return useMemo(() => {
    if (
      playerCarIdx == null ||
      playerClassId == null ||
      sectors.length === 0 ||
      !refLap
    ) {
      return { refSectorTimes: [], hasReferenceLap: false };
    }

    if (refLap.startTime < 0 || refLap.pointsCount === 0) {
      return { refSectorTimes: [], hasReferenceLap: false };
    }

    const lapTime = refLap.finishTime - refLap.startTime;
    if (lapTime <= 0) return { refSectorTimes: [], hasReferenceLap: false };

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

    return { refSectorTimes, hasReferenceLap: true };
    // refLap selector triggers re-run if the reference lap object changes.
  }, [playerCarIdx, playerClassId, sectors, refLap]);
};
