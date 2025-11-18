import { useEffect, useRef } from 'react';
import {
  useTelemetryValue,
  useTelemetryValues,
  useTrackLength,
} from '@irdashies/context';
import { useRelativeGapStore } from './RelativeGapStore';

/**
 * Hook that automatically updates the RelativeGapStore with telemetry data.
 * This samples position data and detects lap completions to build position/time records.
 *
 * Uses granular telemetry hooks to avoid unnecessary re-renders and follows
 * the established pattern from LapTimesStoreUpdater.
 */
export const useRelativeGapStoreUpdater = () => {
  // Use granular hooks to only subscribe to specific telemetry values
  const sessionTime = useTelemetryValue('SessionTime') ?? 0;
  const sessionNum = useTelemetryValue('SessionNum') ?? -1;
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxLastLapTime = useTelemetryValues('CarIdxLastLapTime');

  // Use existing hook for track length
  const trackLength = useTrackLength();

  // Get store action (stable reference, won't cause re-renders)
  const processPositionUpdates = useRelativeGapStore(
    (state) => state.processPositionUpdates
  );

  // Track last lap numbers to detect lap completions
  const lastLapNumbers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    // Only update if we have valid data
    if (!carIdxLapDistPct || !carIdxLap || !carIdxLastLapTime) return;

    // Call store action with all necessary data
    const updatedLapNumbers = processPositionUpdates({
      sessionTime,
      sessionNum,
      trackLength,
      carIdxLapDistPct,
      carIdxLap,
      carIdxLastLapTime,
      lastLapNumbers: lastLapNumbers.current,
    });

    // Update ref with new lap numbers
    lastLapNumbers.current = updatedLapNumbers;
  }, [
    sessionTime,
    sessionNum,
    trackLength,
    carIdxLapDistPct,
    carIdxLap,
    carIdxLastLapTime,
    processPositionUpdates,
  ]);
};
