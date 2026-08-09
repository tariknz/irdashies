import { useEffect } from 'react';
import { useSessionBarSnapshot } from '../ChannelStore';
import { useTopSpeedStore } from './TopSpeedStore';

/**
 * Hook that feeds live Speed + Lap telemetry into the TopSpeedStore.
 * Call with `enabled: true` in any component that needs top speed tracking.
 * Multiple callers are safe — updates are idempotent.
 */
export const useTopSpeedStoreUpdater = (enabled: boolean) => {
  const snapshot = useSessionBarSnapshot();

  useEffect(() => {
    if (!enabled || !snapshot) return;
    useTopSpeedStore.setState({
      lastLapTopSpeed: snapshot.lastLapTopSpeed,
      sessionBestTopSpeed: snapshot.sessionBestTopSpeed,
      sessionNum: snapshot.sessionNum,
    });
  }, [enabled, snapshot]);
};

/**
 * Non-rendering component that feeds Speed telemetry into the TopSpeedStore.
 * Mount once as a sibling outside SessionBar so that the 60fps Speed
 * subscription is isolated here and does not force SessionBar to re-render.
 */
export const TopSpeedStoreUpdater = ({ enabled }: { enabled: boolean }) => {
  useTopSpeedStoreUpdater(enabled);
  return null;
};
