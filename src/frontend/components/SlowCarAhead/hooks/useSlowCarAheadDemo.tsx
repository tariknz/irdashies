import { useEffect, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { useSlowCarAheadSettings } from './useSlowCarAheadSettings';

// The time the animation cycle should take to complete, milliseconds
const cycleLength = 4000;

// The update interval, milliseconds
const interval = 50;

/**
 * If demo mode is enabled, generates demo data for the Slow Car Ahead widget, simulating a car that gets further away & closer in a cyclical pattern. Also cycles stopped and on track properties.
 * If demo mode is not enabled, return null.
 */
export const useSlowCarAheadDemo = () => {
  const { isDemoMode } = useDashboard();
  const [data, setData] = useState<{
    isStopped: boolean;
    distance: number;
    isOffTrack: boolean;
  } | null>(null);

  const settings = useSlowCarAheadSettings();

  useEffect(() => {
    if (!isDemoMode) {
      setData(null);
      return;
    }

    let counter = 0;

    const fullCycleUpdateCount = cycleLength / interval;
    const midCycleUpdateCount = fullCycleUpdateCount / 2;

    const updateInterval = setInterval(() => {
      const cycleUpdateCount = counter % fullCycleUpdateCount;

      const cycleProgress = cycleUpdateCount / midCycleUpdateCount;

      const factor =
        cycleProgress <= 1
          ? cycleProgress // in first half of cycle, progress factor from 0->1
          : 2 - cycleProgress; // in 2nd half of cycle progress factor from 1->0

      // Have stopped and off track change a couple of times in the cycle so user don't think it is tied to distance
      setData({
        isStopped: factor < 0.25 || factor > 0.75,
        distance: factor * settings.maxDistance,
        isOffTrack: factor > 0.5 && factor < 0.75,
      });

      counter++;
    }, interval);

    return () => clearInterval(updateInterval);
  }, [isDemoMode, settings.maxDistance]);

  return data;
};
