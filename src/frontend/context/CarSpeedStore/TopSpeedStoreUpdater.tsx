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
  const prevSessionNumRef = useRef<number | undefined | null>(undefined);

  useEffect(() => {
    const prev = prevSessionNumRef.current;
    prevSessionNumRef.current = sessionNum;
    if (sessionNum === undefined) return;
    if (prev === undefined) return;
    if (prev === sessionNum) return;
    reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (enabled && speed !== undefined && lap !== undefined) {
      update(speed, lap, sessionNum ?? null);
    }
  }, [speed, lap, sessionNum, update, enabled]);
};
