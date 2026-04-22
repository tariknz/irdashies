import { useMemo } from 'react';
import {
  useDashboard,
  useSectorTimingStore,
  useReferenceLapSectorTimes,
  type SectorColor,
} from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import { computeGhostSectorColor } from '../../SectorDelta/sectorColorUtils';

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
      return computeGhostSectorColor(
        lapTime,
        refSectorTimes[i] ?? null,
        sectorDeltaConfig?.thresholds
      );
    });
  }, [
    sectorDeltaConfig?.ghostComparison,
    sectorDeltaConfig?.thresholds,
    hasGhostLap,
    sectors,
    currentSectorIdx,
    currentLapSectorTimes,
    previousLapSectorTimes,
    refSectorTimes,
  ]);
};
