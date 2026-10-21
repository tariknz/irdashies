import { useEffect, useState } from 'react';
import type { RadarFrame } from '../components/RadarDisplay';
import { demoRadarFrame } from '../radarDemo';

/** The scripted demo pack, moving, while `enabled`. */
export const useDemoRadarFrame = (enabled: boolean): RadarFrame | null => {
  const [frame, setFrame] = useState<RadarFrame | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const started = performance.now();
    const timer = setInterval(
      () => setFrame(demoRadarFrame((performance.now() - started) / 1000)),
      40
    );
    return () => {
      clearInterval(timer);
      setFrame(null);
    };
  }, [enabled]);
  return enabled ? (frame ?? demoRadarFrame(0)) : null;
};
