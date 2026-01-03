import { useLapTimes } from '../LapTimesStore/LapTimesStore';
import { useCarIdxClassEstLapTime } from '../SessionStore/SessionStore';

/**
 * @returns An array of average lap times in seconds for each car in the session by index. Uses estimated class lap time if lap time is not known.
 * 
 * Note: This hook only reads lap times. Updates are handled by LapTimesStoreUpdater.
 */
export function useCarIdxAverageLapTime() {
  const lapTimes = useLapTimes();
  const classTimesByCarIdx = useCarIdxClassEstLapTime();

  return lapTimes.map((lapTime, index) => {
    const classLapTime = classTimesByCarIdx?.[index] || 0;
    return lapTime || classLapTime || -1; // use class lap time if last lap time is not known
  });
}
