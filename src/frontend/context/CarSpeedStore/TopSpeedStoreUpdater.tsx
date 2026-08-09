import { useEffect } from 'react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useSessionBarSelector } from '../ChannelStore';
import { useTopSpeedStore } from './TopSpeedStore';

const EMPTY_TOP_SPEEDS: readonly [number | null, number | null, number | null] =
  [null, null, null];

const selectTopSpeeds = (snapshot: SessionBarSnapshot) =>
  [
    snapshot.lastLapTopSpeed,
    snapshot.sessionBestTopSpeed,
    snapshot.sessionNum,
  ] as const;

/**
 * Hook that feeds live Speed + Lap telemetry into the TopSpeedStore.
 * Call with `enabled: true` in any component that needs top speed tracking.
 * Multiple callers are safe — updates are idempotent.
 */
export const useTopSpeedStoreUpdater = (enabled: boolean) => {
  const selected = useSessionBarSelector(selectTopSpeeds, {
    equality: shallow,
  });
  const hasSnapshot = selected !== undefined;
  const [lastLapTopSpeed, sessionBestTopSpeed, sessionNum] =
    selected ?? EMPTY_TOP_SPEEDS;

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
