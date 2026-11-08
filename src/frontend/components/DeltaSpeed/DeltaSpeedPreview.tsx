import { useEffect, useState } from 'react';
import type { DeltaSpeedConfig } from '@irdashies/types';
import { DeltaSpeedDisplay } from './DeltaSpeed';

export const DeltaSpeedPreview = (config: DeltaSpeedConfig) => {
  const [delta, setDelta] = useState(4.2);
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setDelta(Math.sin(tick / 8) * 9);
    }, 100);
    return () => clearInterval(timer);
  }, []);
  return <DeltaSpeedDisplay {...config} deltaKph={delta} />;
};
