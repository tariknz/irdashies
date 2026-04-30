import { useMemo } from 'react';
import { useLapTimeHistory } from '../LapTimesStore/LapTimesStore';

/**
 * Returns a rolling average lap time per carIdx over the last `numLaps` laps.
 * Returns 0 for cars with insufficient history.
 */
export function useCarIdxRollingAvgLapTime(numLaps: number): number[] {
  const lapTimeHistory = useLapTimeHistory();

  return useMemo(() => {
    return lapTimeHistory.map((history) => {
      const window = history.slice(-numLaps);
      if (window.length === 0) return 0;
      return window.reduce((sum, t) => sum + t, 0) / window.length;
    });
  }, [lapTimeHistory, numLaps]);
}
