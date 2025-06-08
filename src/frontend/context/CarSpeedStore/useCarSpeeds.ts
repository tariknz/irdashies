import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useCarSpeedsStore } from './CarSpeedsStore';

/**
 * Custom hook to update car speeds using both telemetry and session (track length) state.
 * Keeps TelemetryStore decoupled from SessionStore.
 */
export function useCarSpeeds() {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const updateCarSpeeds = useCarSpeedsStore(state => state.updateCarSpeeds);
  const session = useSessionStore(state => state.session);

  // Extract track length from session
  const lengthStr = session?.WeekendInfo?.TrackLength;
  let trackLength = 0;
  if (lengthStr) {
    const [value, unit] = lengthStr.split(' ');
    trackLength = unit === 'km' ? parseFloat(value) * 1000 : parseFloat(value);
  }

  useEffect(() => {
    if (telemetry && trackLength) {
      updateCarSpeeds(telemetry, trackLength);
    }
  }, [telemetry, trackLength, updateCarSpeeds]);
}