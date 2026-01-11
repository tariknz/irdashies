import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
  useCurrentSessionType,
  useFocusCarIdx,
  useTelemetryValue,
  useCarIdxClassEstLapTime,
  useTelemetryValues
} from '@irdashies/context';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export const useTotalRaceLaps = () => {
  const carIdx = useFocusCarIdx() as number;
  const { timeRemaining, timeTotal, totalLaps } = useSessionLapCount();
  const lap = useTelemetryValues("CarIdxLap")?.[carIdx] as number;
  const sessionType = useCurrentSessionType();
  const lapDistPct = useTelemetryValue('LapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  // TODO: Switch to useCarIdxAverageLapTime()
  const avgLapTime = useCarIdxClassEstLapTime()?.[carIdx];
  const isFixedLapRace = totalLaps > 0;
  const result = {
    isFixedLapRace: isFixedLapRace,
    totalRaceLaps: 0
  };

  // No race, no business
  if (sessionType != 'Race')
    return result;

  if (isFixedLapRace) {
    // Easy case, fixed lap count. We just have to account for the race leader that might have lapped us
    result.totalRaceLaps = totalLaps;

    let leaderLap = 0;
    let leaderLapDistPct = 0;
    for (let i = 0; i < carIdxPosition.length; i++) {
      if (carIdxPosition[i] === 1) {
        leaderLap = carIdxLap[i];
        leaderLapDistPct = carIdxLapDistPct[i];
        break;
      }
    }
    if (
      lap !== undefined &&
      leaderLap !== undefined &&
      lapDistPct !== undefined &&
      leaderLapDistPct !== undefined &&
      lap > 0 &&
      leaderLap > 0
    ) {
      const totalDist = lap + lapDistPct;
      const totalLeaderDist = leaderLap + leaderLapDistPct;
      if (totalLeaderDist > totalDist) {
        result.totalRaceLaps -= Math.floor(totalLeaderDist - totalDist);
      }
    }
  }
  else {
    // Time-limited race, so we have to estimate based on remaining time and expected laptimes
    // In replays, the average lap time is reported as 1s, which is obviously invalid, so we skip
    // the estimation in this case
    if (avgLapTime !== undefined && avgLapTime > 1) {
      if (lap === 0) {
        // Race has not yet started
        result.totalRaceLaps = (timeTotal / avgLapTime);
      }
      else if (lapDistPct !== undefined) {
        // Race has started, so we have to add the number of completed laps and the percentage of the current lap
        result.totalRaceLaps = ((timeRemaining / avgLapTime) + (lap - 1) + lapDistPct);
      }
    }
  }
  return result;
}