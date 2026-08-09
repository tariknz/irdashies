import { useEffect } from 'react';
import { useStandingsSnapshot } from '../ChannelStore';
import { usePitLapStore } from './PitLapStore';

export const usePitLapStoreUpdater = (enabled: boolean) => {
  const snapshot = useStandingsSnapshot(enabled);
  const updatePitLapTimes = usePitLapStore((state) => state.updatePitLaps);

  useEffect(() => {
    if (!enabled || !snapshot) return;
    updatePitLapTimes(
      snapshot.carIdxOnPitRoad,
      snapshot.carIdxLap,
      snapshot.sessionUniqueId,
      Math.floor(snapshot.sessionTime),
      snapshot.carIdxTrackSurface,
      snapshot.sessionState
    );
  }, [enabled, snapshot, updatePitLapTimes]);
};
