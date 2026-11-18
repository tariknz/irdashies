import { useMemo } from 'react';
import { useLapTimeHistory } from '../LapTimesStore/LapTimesStore';

/**
 * Returns a rolling average lap time per carIdx over the last `numLaps` laps.
 * Uses available history while the window fills; 0 means no eligible laps.
 */
export function useCarIdxRollingAvgLapTime(
  numLaps: number,
  excludePitLaps = false
): number[] {
  const lapTimeHistory = useLapTimeHistory(excludePitLaps);

  return useMemo(() => {
    const count = Number.isFinite(numLaps)
      ? Math.max(1, Math.min(100, Math.trunc(numLaps)))
      : 5;
    return lapTimeHistory.map((history) => {
      const window = history.slice(-count);
      if (window.length === 0) return 0;
      return window.reduce((sum, t) => sum + t, 0) / window.length;
    });
  }, [lapTimeHistory, numLaps]);
}
