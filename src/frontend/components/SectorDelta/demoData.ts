import type { Sector } from '@irdashies/types';
import type { SectorColor } from '@irdashies/context';
import type { SectorDeltaData } from './SectorDeltaDisplay';

export const DEMO_SECTOR_INTERVAL_MS = 3000;

export function demoSectorData(
  sectors: Sector[],
  tick: number
): SectorDeltaData {
  const best = sectors.map((_, index) => 18 + index * 1.7);
  const colors: SectorColor[] = ['purple', 'green', 'yellow', 'red'];
  const times = best.map(
    (time, index) => time + [-0.15, -0.08, 0.2, 0.5][(index + tick) % 4]
  );
  return {
    sectors,
    sectorColors: sectors.map((_, index) => colors[(index + tick) % 4]),
    currentLapSectorTimes: times,
    previousLapSectorTimes: times,
    currentLapSectorUnclean: sectors.map(() => false),
    previousLapSectorUnclean: sectors.map(() => false),
    sessionBestSectorTimes: best,
    previousSessionBestSectorTimes: best,
    currentSectorIdx: sectors.length ? tick % sectors.length : 0,
  };
}
