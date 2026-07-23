import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
  useCurrentSessionType,
  useCarIdxClassEstLapTime,
  useFocusCarIdx,
  useTelemetryValue,
  useTelemetryValues,
  useTelemetryValuesRounded,
} from '@irdashies/context';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';
import { SessionState } from '@irdashies/types';
import {
  calculateTimedRaceDistance,
  selectRaceLapTime,
} from './raceDistanceCalculations';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export const useTotalRaceValue = () => {
  const carIdx = useFocusCarIdx() as number;
  const { timeRemaining, timeTotal, totalLaps, state } = useSessionLapCount();
  const lap = useTelemetryValues('CarIdxLap')?.[carIdx] as number;
  const sessionType = useCurrentSessionType();
  const lapDistPct = useTelemetryValue('LapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const carIdxLapDistPct = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
  const avgLapTimes = useCarIdxAverageLapTime();
  const bestLapTimes = useTelemetryValues('CarIdxBestLapTime');
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const isFixedLapRace = !(timeRemaining > 0 && timeRemaining !== 604800);
  const result = {
    isFixedLapRace: isFixedLapRace,
    totalRaceLaps: 0,
    totalRaceTime: 0,
    adjustedRaceTime: 0,
    estimatedLapsRemaining: 0,
    hasValidRaceEstimate: false,
  };

  // No race, no business
  if (sessionType !== 'Race') return result;

  let leaderCarIdx = -1;
  let leaderLap = 0;
  let leaderLapDistPct = 0;
  for (let i = 0; i < carIdxPosition.length; i++) {
    if (
      carIdxPosition[i] === 1 &&
      carIdxLap[i] !== undefined &&
      carIdxLapDistPct[i] !== undefined
    ) {
      leaderCarIdx = i;
      leaderLap = carIdxLap[i] ?? 0;
      leaderLapDistPct = carIdxLapDistPct[i] ?? 0;
      break;
    }
  }
  // When no leader found yet (pre-race), fall back to player's carIdx for lap time lookup
  const lapTimeCarIdx = leaderCarIdx >= 0 ? leaderCarIdx : carIdx;
  // Use P1's average lap time, falling back to class estimated lap time if no laps recorded yet
  // Use best lap time as last resort
  const avgLapTime = selectRaceLapTime(
    avgLapTimes[lapTimeCarIdx],
    classEstLapTimes?.[lapTimeCarIdx],
    bestLapTimes?.[lapTimeCarIdx],
    avgLapTimes[carIdx],
    classEstLapTimes?.[carIdx],
    bestLapTimes?.[carIdx]
  );

  if (isFixedLapRace) {
    // Easy case, fixed lap count. We just have to account for the race leader that might have lapped us
    result.totalRaceLaps = totalLaps;

    const lapsValid =
      lap !== undefined &&
      leaderLap !== undefined &&
      lapDistPct !== undefined &&
      leaderLapDistPct !== undefined &&
      lap > 0 &&
      leaderLap > 0;
    if (lapsValid) {
      const totalDist = lap + lapDistPct;
      const totalLeaderDist = leaderLap + leaderLapDistPct;

      if (totalLeaderDist > totalDist) {
        result.totalRaceLaps -= Math.floor(totalLeaderDist - totalDist);
      }
    }

    if (avgLapTime !== null) {
      result.totalRaceTime = totalLaps * avgLapTime;
      result.adjustedRaceTime = result.totalRaceTime;

      if (lapsValid) {
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

    if (avgLapTime !== null) {
      if (lap === 0) {
        // Race has not yet started
        result.totalRaceLaps = timeTotal / avgLapTime;
        result.estimatedLapsRemaining = Math.ceil(result.totalRaceLaps);
        result.hasValidRaceEstimate = true;
      } else {
        const estimateLeaderLap = leaderCarIdx >= 0 ? leaderLap : lap;
        const estimateLeaderLapDistPct =
          leaderCarIdx >= 0 ? leaderLapDistPct : (lapDistPct ?? 0);
        const estimate = calculateTimedRaceDistance(
          timeRemaining,
          avgLapTime,
          lap,
          lapDistPct ?? 0,
          estimateLeaderLap,
          estimateLeaderLapDistPct
        );

        if (estimate) {
          result.totalRaceLaps = estimate.totalRaceLaps;
          result.estimatedLapsRemaining = estimate.lapsRemaining;
          result.hasValidRaceEstimate = true;
        }
      }
    }

    if ((totalLaps ?? 0) > 0 && result.totalRaceLaps > totalLaps) {
      result.totalRaceLaps = totalLaps;
    }
  }

  if (state >= SessionState.Checkered) {
    // After checkered: freeze at the lap count captured when the flag was shown
    return {
      isFixedLapRace: isFixedLapRace,
      totalRaceLaps: lap,
      totalRaceTime: result.totalRaceTime,
      adjustedRaceTime: result.adjustedRaceTime,
      estimatedLapsRemaining: 0,
      hasValidRaceEstimate: true,
    };
  }

  return result;
};
