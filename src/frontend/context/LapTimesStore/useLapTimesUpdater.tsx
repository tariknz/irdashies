import { useEffect } from 'react';
import { useLapTimesStore } from './LapTimesStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';

export const useLapTimesUpdater = () => {
  const telemetry = useTelemetryStore((state) => state.telemetry);
  const updateLapTimes = useLapTimesStore((state) => state.updateLapTimes);

  useEffect(() => {
    if (telemetry) {
      updateLapTimes(telemetry);
    }
  }, [telemetry, updateLapTimes]);
}; 