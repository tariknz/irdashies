import { useEffect, useRef } from 'react';
import { useTelemetryValue } from '../TelemetryStore/TelemetryStore';
import { useTopSpeedStore } from './TopSpeedStore';

/**
 * Hook that feeds live Speed + Lap telemetry into the TopSpeedStore.
 * Call with `enabled: true` in any component that needs top speed tracking.
 * Multiple callers are safe — updates are idempotent.
 */
export const useTopSpeedStoreUpdater = (enabled: boolean) => {
  const speed = useTelemetryValue('Speed');
  const lap = useTelemetryValue('Lap');
  const sessionNum = useTelemetryValue('SessionNum');
  const update = useTopSpeedStore((s) => s.update);
  const reset = useTopSpeedStore((s) => s.reset);
  const prevSessionNumRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionNum === undefined) return;
    const prev = prevSessionNumRef.current;
    prevSessionNumRef.current = sessionNum;
    if (prev === null) return; // initial load — no reset
    if (prev === sessionNum) return;
    reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (enabled && speed !== undefined && lap !== undefined) {
      update(speed, lap, sessionNum ?? null);
    }
  }, [speed, lap, sessionNum, update, enabled]);
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
