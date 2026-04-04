import { useMemo } from 'react';
import { useSessionStore } from '@irdashies/context';

export const useSectorBoundaries = (enabled: boolean) => {
  const session = useSessionStore((state) => state.session);

  const sectorBoundaries = useMemo(() => {
    if (!enabled || !session) {
      return null;
    }

    try {
      const splitTimeInfo = session.SplitTimeInfo;
      if (!splitTimeInfo?.Sectors || splitTimeInfo.Sectors.length === 0) {
        return null;
      }

      const sectors = splitTimeInfo.Sectors;

      const sortedSectors = [...sectors].sort(
        (a, b) => a.SectorStartPct - b.SectorStartPct
      );
      const rawBoundaries = [
        0,
        ...sortedSectors.map((s) => s.SectorStartPct),
        1,
      ];
      const boundaries = rawBoundaries.filter(
        (val, idx, arr) => idx === 0 || val !== arr[idx - 1]
      );

      if (boundaries.length < 2) {
        return null;
      }

      return boundaries;
    } catch {
      return null;
    }
  }, [enabled, session]);

  return sectorBoundaries;
};
