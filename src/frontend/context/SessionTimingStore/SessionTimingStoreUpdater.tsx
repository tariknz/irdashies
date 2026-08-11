import { useEffect } from 'react';
import { useSessionTimingSnapshot } from '../ChannelStore';
import { useSessionTimingStore } from './SessionTimingStore';

export const useSessionTimingStoreUpdater = (enabled: boolean) => {
  const snapshot = useSessionTimingSnapshot(enabled);
  const update = useSessionTimingStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    if (!snapshot) return;
    update({
      sessionType: snapshot.sessionType,
      state: snapshot.state,
      currentLap: snapshot.currentLap,
      totalLaps: snapshot.totalLaps,
      time: snapshot.time,
      timeTotal: snapshot.timeTotal,
      timeRemaining: snapshot.timeRemaining,
      greenFlagTimestamp: snapshot.greenFlagTimestamp,
      isFixedLapRace: snapshot.isFixedLapRace,
      totalRaceLaps: snapshot.totalRaceLaps,
      totalRaceTime: snapshot.totalRaceTime,
      adjustedRaceTime: snapshot.adjustedRaceTime,
    });
  }, [enabled, snapshot, update]);
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
