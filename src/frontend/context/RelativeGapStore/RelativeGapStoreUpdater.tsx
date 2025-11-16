import { useEffect, useRef } from 'react';
// import type { Telemetry } from '@irdashies/types';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useRelativeGapStore } from './RelativeGapStore';

/**
 * Hook that automatically updates the RelativeGapStore with telemetry data.
 * This samples position data and detects lap completions to build position/time records.
 */
export const useRelativeGapStoreUpdater = () => {
  const telemetry = useTelemetryStore((state) => state.telemetry);
  const session = useSessionStore((state) => state.session);

  // Track last lap numbers to detect lap completions
  const lastLapNumbers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!telemetry || !session) return;

    const sessionTime = telemetry.SessionTime?.value?.[0] ?? 0;
    const sessionNum = telemetry.SessionNum?.value?.[0] ?? -1;
    const trackLength = parseTrackLength(session.WeekendInfo?.TrackLength);

    // Get store actions directly without subscribing
    const store = useRelativeGapStore.getState();

    // Update session info (will clear data on session change)
    store.updateSessionInfo(sessionNum, trackLength);

    // Get telemetry arrays
    const carIdxLapDistPct = telemetry.CarIdxLapDistPct?.value || [];
    const carIdxLap = telemetry.CarIdxLap?.value || [];
    const carIdxLastLapTime = telemetry.CarIdxLastLapTime?.value || [];

    // Process each car
    for (let carIdx = 0; carIdx < carIdxLapDistPct.length; carIdx++) {
      const position = carIdxLapDistPct[carIdx];
      const currentLap = carIdxLap[carIdx];
      const lastLapTime = carIdxLastLapTime[carIdx];

      // Skip invalid positions
      if (position < 0 || currentLap < 0) continue;

      // Initialize car history if needed
      store.initializeCarHistory(carIdx, currentLap, sessionTime);

      // Detect lap completion
      const previousLap = lastLapNumbers.current.get(carIdx) ?? currentLap;
      if (currentLap > previousLap && lastLapTime > 0) {
        // Lap completed!
        store.completeLap(carIdx, lastLapTime, sessionTime);
      }

      // Update last lap number
      lastLapNumbers.current.set(carIdx, currentLap);

      // Add position sample for current lap
      store.addPositionSample(carIdx, position, sessionTime, currentLap);
    }
  }, [telemetry, session]);
};

/**
 * Parse track length from session info string (e.g., "2.236 km" -> 2236)
 */
function parseTrackLength(trackLengthStr: string | undefined): number {
  if (!trackLengthStr) return 0;

  // Extract number and unit
  const match = trackLengthStr.match(/([\d.]+)\s*(km|mi)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  // Convert to meters
  if (unit === 'km') {
    return value * 1000;
  } else if (unit === 'mi') {
    return value * 1609.34;
  }

  return value;
}
