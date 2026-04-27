import { useEffect } from 'react';
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

  // Reset immediately when session changes so stale data is cleared
  // before any new telemetry arrives
  useEffect(() => {
    reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (carIdxLastLapTime && enabled) {
      updateLapTimes(carIdxLastLapTime, sessionNum ?? null);
    }
  }, [carIdxLastLapTime, sessionNum, updateLapTimes, enabled]);
};
