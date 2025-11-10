import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from './LapTimesStore';

/**
 * Hook that automatically updates the LapTimesStore with telemetry data.
 * This ensures lap time history is always up-to-date without manual updates in components.
 *
 * Use this hook in components that need lap time history tracking (e.g., Standings overlay).
 */
export const useLapTimesStoreUpdater = () => {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const updateLapTimes = useLapTimesStore(state => state.updateLapTimes);

  useEffect(() => {
    if (telemetry) {
      updateLapTimes(telemetry);
    }
  }, [telemetry, updateLapTimes]);
};
