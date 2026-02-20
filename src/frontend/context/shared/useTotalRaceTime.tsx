import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
  useCurrentSessionType,
  useFocusCarIdx,
  useTelemetryValue,
  useCarIdxClassEstLapTime,
  useTelemetryValues,
} from '@irdashies/context';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export const useTotalRaceTime = () => {
  const carIdx = useFocusCarIdx() as number;
  const { timeTotal, totalLaps } = useSessionLapCount();
  const lap = useTelemetryValues('CarIdxLap')?.[carIdx] as number;
  const sessionType = useCurrentSessionType();
  const lapDistPct = useTelemetryValue('LapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const avgLapTimes = useCarIdxAverageLapTime();
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const isFixedLapRace = totalLaps > 0;
  const result = {
    isFixedLapRace: isFixedLapRace,
    totalRaceTime: 0,
    adjustedRaceTime: 0,
  };

  // No race, no business
  if (sessionType != 'Race') return result;

  if (isFixedLapRace) {
    // Easy case, fixed lap count. We just have to account for the race leader that might have lapped us
    let leaderCarIdx = -1;
    let leaderLap = 0;
    let leaderLapDistPct = 0;
    for (let i = 0; i < carIdxPosition.length; i++) {
      if (carIdxPosition[i] === 1) {
        leaderCarIdx = i;
        leaderLap = carIdxLap[i];
        leaderLapDistPct = carIdxLapDistPct[i];
        break;
      }
    }
    // When no leader found yet (pre-race), fall back to player's carIdx for lap time lookup
    const lapTimeCarIdx = leaderCarIdx >= 0 ? leaderCarIdx : carIdx;
    // Use P1's average lap time, falling back to class estimated lap time if no laps recorded yet
    const avgLapTime =
      (avgLapTimes[lapTimeCarIdx] > 0
        ? avgLapTimes[lapTimeCarIdx]
        : classEstLapTimes?.[lapTimeCarIdx]) ?? -1;
    if (avgLapTime > 0) {
      result.totalRaceTime = totalLaps * avgLapTime;
      result.adjustedRaceTime = result.totalRaceTime;
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
          result.adjustedRaceTime =
            (totalLaps - Math.floor(totalLeaderDist - totalDist)) * avgLapTime;
        }
      }
    }
  } else {
    // Time-limited race, so we have to estimate based on remaining time and expected laptimes
    // In replays, the average lap time is reported as 1s, which is obviously invalid, so we skip
    // the estimation in this case
    result.totalRaceTime = timeTotal;
  }
  return result;
};
