import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from './LapTimesStore';

/**
 * Provider component that automatically updates the LapTimesStore with telemetry data.
 * This ensures lap time history is always up-to-date without manual updates in components.
 */
export const LapTimesStoreUpdater = ({ children }: { children: React.ReactNode }) => {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const updateLapTimes = useLapTimesStore(state => state.updateLapTimes);

  useEffect(() => {
    if (telemetry) {
      updateLapTimes(telemetry);
    }
  }, [telemetry, updateLapTimes]);

  return <>{children}</>;
};
