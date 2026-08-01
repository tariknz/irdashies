import { useEffect } from 'react';
import { useTotalRaceValue } from '../shared/useTotalRaceValue';
import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import { useSessionTimingStore } from './SessionTimingStore';

export const useSessionTimingStoreUpdater = () => {
  const sessionLapCount = useSessionLapCount();
  const totalRaceValue = useTotalRaceValue();
  const update = useSessionTimingStore((s) => s.update);

  useEffect(() => {
    update({ ...sessionLapCount, ...totalRaceValue });
  }, [sessionLapCount, totalRaceValue, update]);
};

/**
 * Mount once as a sibling near SessionBar so useSessionLapCount/useTotalRaceValue's
 * leader-car loop + effect run once instead of once per SessionBar item that needs them.
 */
export const SessionTimingStoreUpdater = () => {
  useSessionTimingStoreUpdater();
  return null;
};
