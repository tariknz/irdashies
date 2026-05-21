import { useEffect, useRef } from 'react';
import {
  useTelemetryValue,
  useTelemetryValues,
} from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from './LapTimesStore';

/**
 * Hook that automatically updates the LapTimesStore with telemetry data.
 * Pass `enabled: true` when any lap-time-dependent feature (deltas, avg lap)
 * is active in the consuming widget. Multiple widgets can call this safely —
 * the store update is idempotent and cheap.
 */
export const useLapTimesStoreUpdater = (enabled: boolean) => {
  const sessionNum = useTelemetryValue('SessionNum');
  const carIdxLastLapTime = useTelemetryValues('CarIdxLastLapTime');
  const updateLapTimes = useLapTimesStore((state) => state.updateLapTimes);
  const reset = useLapTimesStore((state) => state.reset);
  const prevSessionNumRef = useRef<number | undefined | null>(undefined);

  // Reset immediately when the session number transitions to a different
  // real value. Skip the initial undefined→undefined render and the
  // undefined→0 SDK-connect transition so we don't log spurious resets.
  // The store also handles session changes defensively in updateLapTimes.
  useEffect(() => {
    const prev = prevSessionNumRef.current;
    prevSessionNumRef.current = sessionNum;
    if (sessionNum === undefined) return;
    if (prev === undefined) return;
    if (prev === sessionNum) return;
    reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (carIdxLastLapTime && enabled) {
      updateLapTimes(carIdxLastLapTime, sessionNum ?? null);
    }
  }, [carIdxLastLapTime, sessionNum, updateLapTimes, enabled]);
};
