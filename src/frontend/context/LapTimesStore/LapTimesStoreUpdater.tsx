import { useEffect } from 'react';
import { useLapTimesSnapshot } from '../ChannelStore';
import { useLapTimesStore } from './LapTimesStore';

/**
 * Mirrors the main-process lap-times channel into the presentation store.
 * Pass `enabled: true` when any lap-time-dependent feature (deltas, avg lap)
 * is active in the consuming widget. Multiple widgets can call this safely.
 */
export const useLapTimesStoreUpdater = (enabled: boolean) => {
  const snapshot = useLapTimesSnapshot(enabled);
  const applySnapshot = useLapTimesStore((state) => state.applySnapshot);

  useEffect(() => {
    if (snapshot && enabled) applySnapshot(snapshot);
  }, [applySnapshot, enabled, snapshot]);
};
