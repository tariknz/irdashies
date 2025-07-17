import { useMemo } from 'react';
import { useLapTimes } from '../LapTimesStore/LapTimesStore';
import { useCarIdxClassEstLapTime } from '../SessionStore/SessionStore';

/**
 * @returns An array of average lap times in seconds for each car in the session by index. Uses estimated class lap time if lap time is not known.
 */
export function useCarIdxAverageLapTime() {
  const lapTimes = useLapTimes();
  const classTimesByCarIdx = useCarIdxClassEstLapTime();

  return useMemo(
    () =>
      Object.entries(classTimesByCarIdx ?? {}).map(([carIdx, classLapTime]) => {
        const lapTime = lapTimes[Number(carIdx)] || 0;
        return lapTime || classLapTime || -1;
      }),
    [lapTimes, classTimesByCarIdx],
  );
}
