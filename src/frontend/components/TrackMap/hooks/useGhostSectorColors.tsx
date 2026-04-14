import { useMemo } from 'react';
import {
  useDashboard,
  useSectorTimingStore,
  useReferenceLapSectorTimes,
  type SectorColor,
} from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';

const GHOST_THRESHOLD = 0.5;

function ghostColor(
  lapTime: number | null,
  refTime: number | null
): SectorColor {
  if (lapTime === null || refTime === null) return 'default';
  const delta = lapTime - refTime;
  if (delta <= 0) return 'green';
  if (delta <= GHOST_THRESHOLD) return 'yellow';
  return 'red';
}

/**
 * Returns ghost-comparison sector colors when the SectorDelta widget is set to
 * 'prefer-ghost' and a ghost lap is loaded. Returns null otherwise, signaling
 * callers to fall back to session-best colors.
 */
export const useGhostSectorColors = (): SectorColor[] | null => {
  const { currentDashboard } = useDashboard();
  const sectorDeltaConfig = currentDashboard?.widgets.find(
    (w) => w.id === 'sectordelta'
  )?.config as SectorDeltaConfig | undefined;

  const { refSectorTimes, hasGhostLap } = useReferenceLapSectorTimes();
  const sectors = useSectorTimingStore((s) => s.sectors);
  const currentSectorIdx = useSectorTimingStore((s) => s.currentSectorIdx);
  const currentLapSectorTimes = useSectorTimingStore(
    (s) => s.currentLapSectorTimes
  );
  const previousLapSectorTimes = useSectorTimingStore(
    (s) => s.previousLapSectorTimes
  );

  return useMemo(() => {
    if (
      (sectorDeltaConfig?.ghostComparison ?? 'prefer-ghost') !==
        'prefer-ghost' ||
      !hasGhostLap
    ) {
      return null;
    }

    return sectors.map((_, i) => {
      if (i === currentSectorIdx) return 'default';
      const lapTime =
        currentLapSectorTimes[i] ?? previousLapSectorTimes[i] ?? null;
      return ghostColor(lapTime, refSectorTimes[i] ?? null);
    });
  }, [
    sectorDeltaConfig?.ghostComparison,
    hasGhostLap,
    sectors,
    currentSectorIdx,
    currentLapSectorTimes,
    previousLapSectorTimes,
    refSectorTimes,
  ]);
};
