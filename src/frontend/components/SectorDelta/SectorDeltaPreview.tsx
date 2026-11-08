import { useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import { SectorDeltaDisplay } from './SectorDeltaDisplay';
import { DEMO_SECTOR_INTERVAL_MS, demoSectorData } from './demoData';

export const SectorDeltaPreview = (config: SectorDeltaConfig) => {
  const sectors = useSessionStore(
    (state) => state.session?.SplitTimeInfo?.Sectors
  );
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setTick((previous) => previous + 1),
      DEMO_SECTOR_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, []);
  const data = useMemo(
    () => demoSectorData(sectors ?? [], tick),
    [sectors, tick]
  );
  return <SectorDeltaDisplay {...config} data={data} demo />;
};
