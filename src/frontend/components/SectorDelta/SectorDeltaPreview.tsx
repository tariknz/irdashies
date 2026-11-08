import { useEffect } from 'react';
import { useSectorTimingStore, useSessionStore } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import { SectorDelta } from './SectorDelta';

export const SectorDeltaPreview = (config: SectorDeltaConfig) => {
  const sectors = useSessionStore(
    (state) => state.session?.SplitTimeInfo?.Sectors
  );
  useEffect(() => {
    if (!sectors?.length) return;
    const best = sectors.map((_, index) => 18 + index * 1.7);
    const colors = ['purple', 'green', 'yellow', 'red'] as const;
    const update = (tick: number) =>
      useSectorTimingStore.setState({
        sectors,
        sectorColors: sectors.map(
          (_, index) => colors[(index + tick) % colors.length]
        ),
        currentLapSectorTimes: best.map(
          (time, index) => time + [-0.15, -0.08, 0.2, 0.5][(index + tick) % 4]
        ),
        sessionBestSectorTimes: best,
        sectorEntryValid: true,
        currentSectorIdx: tick % sectors.length,
        sectorEntryTime: 0,
      });
    let tick = 0;
    update(tick);
    const timer = setInterval(() => update(++tick), 3000);
    return () => clearInterval(timer);
  }, [sectors]);
  return <SectorDelta {...config} />;
};
