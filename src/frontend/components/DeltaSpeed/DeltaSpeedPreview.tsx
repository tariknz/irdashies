import { useEffect, useState } from 'react';
import type { DeltaSpeedConfig } from '@irdashies/types';
import { DeltaSpeedDisplay } from './DeltaSpeedDisplay';
import { DEMO_DELTA_INTERVAL_MS, demoDeltaKph } from './demoData';

export const DeltaSpeedPreview = (config: DeltaSpeedConfig) => {
  const [delta, setDelta] = useState(() => demoDeltaKph(0));
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setDelta(demoDeltaKph(tick));
    }, DEMO_DELTA_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return <DeltaSpeedDisplay {...config} deltaKph={delta} />;
};
