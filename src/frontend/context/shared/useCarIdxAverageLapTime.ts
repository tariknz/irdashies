import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimes, useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { useCarIdxClassEstLapTime } from '../SessionStore/SessionStore';

/**
 * @returns An array of average lap times in seconds for each car in the session by index. Uses estimated class lap time if lap time is not known.
 */
export function useCarIdxAverageLapTime() {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const updateLapTimes = useLapTimesStore(state => state.updateLapTimes);
  const lapTimes = useLapTimes();
  const classTimesByCarIdx = useCarIdxClassEstLapTime();

  useEffect(() => {
    if (telemetry) {
      updateLapTimes(telemetry);
    }
  }, [telemetry, updateLapTimes]);

  return lapTimes.map((lapTime, index) => {
    const classLapTime = classTimesByCarIdx?.[index] || 0;
    return lapTime || classLapTime || -1; // use class lap time if last lap time is not known
  });
}
