import { useEffect, useState } from 'react';
import {
  getDemoWindData,
  WIND_DEMO_INTERVAL_MS,
  type WindDemoData,
} from './wind';

export const useWindDemoData = (
  isDemoMode: boolean,
  metric: boolean
): WindDemoData | null => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isDemoMode) {
      return;
    }

    const intervalId = setInterval(() => {
      setIndex((current) => current + 1);
    }, WIND_DEMO_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isDemoMode]);

  if (!isDemoMode) return null;

  return getDemoWindData(index, metric);
};
