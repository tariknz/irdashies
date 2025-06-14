import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimes, useLapTimesStore } from './LapTimesStore';
import { useSessionStore } from '../SessionStore/SessionStore';

/**
 * Custom hook to update lap times using telemetry state.
 * @returns An array of average lap times for each car in the session by index. Time value in seconds. -1 if not known.
 */
export function useCarIdxAverageLapTime() {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const session = useSessionStore(state => state.session?.DriverInfo?.Drivers);
  const updateLapTimes = useLapTimesStore(state => state.updateLapTimes);
  const lapTimes = useLapTimes();

  useEffect(() => {
    if (telemetry) {
      updateLapTimes(telemetry);
    }
  }, [telemetry, updateLapTimes]);

  return lapTimes.map((lapTime, index) => {
    const classLapTime = session?.find(driver => driver.CarIdx === index)?.CarClassEstLapTime ?? 0;
    return [
      lapTime || classLapTime || -1, // use class lap time if last lap time is not known
    ];
  });
}
