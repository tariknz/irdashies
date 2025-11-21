import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { usePitLapStore } from './PitLapStore';

/**
 * Hook that automatically updates the LapTimesStore with telemetry data.
 * This ensures lap time history is always up-to-date without manual updates in components.
 *
 * Use this hook in components that need lap time history tracking (e.g., Standings overlay).
 */
export const usePitLabStoreUpdater = () => {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const updatePitLapTimes = usePitLapStore(state => state.updatePitLaps);

  useEffect(() => {
    if (telemetry) {
      updatePitLapTimes(telemetry);
    }
  }, [telemetry, updatePitLapTimes]);
};