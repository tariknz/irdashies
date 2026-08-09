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
  const hasSnapshot = snapshot !== undefined;
  const lastLapTopSpeed = snapshot?.lastLapTopSpeed ?? null;
  const sessionBestTopSpeed = snapshot?.sessionBestTopSpeed ?? null;
  const sessionNum = snapshot?.sessionNum ?? null;

  useEffect(() => {
    if (!enabled || !hasSnapshot) return;
    useTopSpeedStore.setState({
      lastLapTopSpeed,
      sessionBestTopSpeed,
      sessionNum,
    });
  }, [enabled, hasSnapshot, lastLapTopSpeed, sessionBestTopSpeed, sessionNum]);
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
