import { useEffect } from 'react';
import { useTelemetryStore } from './TelemetryStore';
import { useThrottledTelemetryStore } from './ThrottledTelemetryStore';
import { usePitLapStore } from '../PitLapStore/PitLapStore';
import { useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { useFocusCarIdx } from '../shared/useFocusCarIdx';

/**
 * The central "Pulse" of the application.
 * Subscribes to raw telemetry and dispatches throttled updates
 * to various stores and updaters at a fixed 10Hz (100ms).
 */
export const HeadlessTelemetryOrchestrator = () => {
  const setThrottledTelemetry = useThrottledTelemetryStore(
    (s) => s.setTelemetry
  );

  // Store update functions
  const updatePitLaps = usePitLapStore((s) => s.updatePitLaps);
  const updateLapTimes = useLapTimesStore((s) => s.updateLapTimes);

  // Context state needed for updaters
  const playerCarIdx = useFocusCarIdx();

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useTelemetryStore.getState();
      const telemetry = state.telemetry;
      if (!telemetry) return;

      // 1. Update Throttled Store (for UI components)
      setThrottledTelemetry(telemetry);

      const sessionTime = telemetry['SessionTime']?.value?.[0] as
        | number
        | undefined;
      const sessionUniqueID = telemetry['SessionUniqueID']?.value?.[0] as
        | number
        | undefined;
      const sessionState = telemetry['SessionState']?.value?.[0] as
        | number
        | undefined;
      const carIdxOnPitRoad = telemetry['CarIdxOnPitRoad']?.value as
        | boolean[]
        | undefined;
      const carIdxLap = telemetry['CarIdxLap']?.value as number[] | undefined;
      const carIdxTrackSurface = telemetry['CarIdxTrackSurface']?.value as
        | number[]
        | undefined;
      const carIdxLastLapTime = telemetry['CarIdxLastLapTime']?.value as
        | number[]
        | undefined;
      const sessionNum = telemetry['SessionNum']?.value?.[0] as
        | number
        | undefined;

      // 2. Pulse PitLapStore
      if (
        carIdxOnPitRoad &&
        carIdxLap &&
        sessionUniqueID !== undefined &&
        sessionTime !== undefined &&
        carIdxTrackSurface &&
        sessionState !== undefined
      ) {
        updatePitLaps(
          carIdxOnPitRoad,
          carIdxLap,
          sessionUniqueID,
          Math.floor(sessionTime), // Throttled integer time as used in original updater
          carIdxTrackSurface,
          sessionState
        );
      }

      // 3. Pulse LapTimesStore (Only if we have a valid session time jump or new data)
      // Original updater didn't have strict throttling beyond react dependency tracking,
      // but here we ensure it runs at 10Hz max.
      if (carIdxLastLapTime) {
        updateLapTimes(
          carIdxLastLapTime,
          sessionNum ?? null,
          playerCarIdx ?? null
        );
      }
    }, 100); // Stable 10Hz

    return () => clearInterval(interval);
  }, [setThrottledTelemetry, updatePitLaps, updateLapTimes, playerCarIdx]);

  return null;
};
