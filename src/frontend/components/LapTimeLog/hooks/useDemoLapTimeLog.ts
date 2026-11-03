import { useEffect, useState } from 'react';
import { getDemoLapTimeLogData, type LapTimeLogDemoData } from '../demoData';

/** Animated Lap Timer demo pack while `enabled`. */
export const useDemoLapTimeLog = (
  enabled: boolean
): LapTimeLogDemoData | null => {
  const [frame, setFrame] = useState<LapTimeLogDemoData | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const started = performance.now();
    const tick = () =>
      setFrame(getDemoLapTimeLogData((performance.now() - started) / 1000));
    tick();
    const timer = setInterval(tick, 50);
    return () => {
      clearInterval(timer);
      setFrame(null);
    };
  }, [enabled]);
  return enabled ? (frame ?? getDemoLapTimeLogData(0)) : null;
};
