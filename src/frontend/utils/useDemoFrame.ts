import { useEffect, useState } from 'react';

/**
 * Ticks `at(elapsedSec)` while `enabled`, matching Radar / Lap Timer demo
 * packs. `at` must be a stable module-level function (or a memoised callback).
 */
export const useDemoFrame = <T>(
  enabled: boolean,
  at: (elapsedSec: number) => T,
  intervalMs = 50
): T | null => {
  const [frame, setFrame] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const started = performance.now();
    const tick = () =>
      setFrame(at((performance.now() - started) / 1000));
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearInterval(timer);
      setFrame(null);
    };
  }, [enabled, at, intervalMs]);
  return enabled ? (frame ?? at(0)) : null;
};
