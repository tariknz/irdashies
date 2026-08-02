import { useEffect } from 'react';
import { useTotalRaceValue } from '../shared/useTotalRaceValue';
import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import { useSessionTimingStore } from './SessionTimingStore';

export const useSessionTimingStoreUpdater = (enabled: boolean) => {
  const sessionLapCount = useSessionLapCount();
  const totalRaceValue = useTotalRaceValue();
  const update = useSessionTimingStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    update({ ...sessionLapCount, ...totalRaceValue });
  }, [enabled, sessionLapCount, totalRaceValue, update]);
};

/**
 * Mount once (see OverlayContainer's SessionTimingUpdater) so
 * useSessionLapCount/useTotalRaceValue's leader-car loop + effect run once
 * instead of once per widget that needs them.
 */
export const SessionTimingStoreUpdater = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  useSessionTimingStoreUpdater(enabled);
  return null;
};
