import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
  useCurrentSessionType,
  useCarIdxClassEstLapTime,
  useFocusCarIdx,
  useTelemetryValue,
  useTelemetryValues,
} from '@irdashies/context';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';
import { SessionState } from '@irdashies/types';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export const useTotalRaceLaps = () => {
  const carIdx = useFocusCarIdx() as number;
  const { timeRemaining, timeTotal, totalLaps, state, currentLap } =
    useSessionLapCount();
  const lap = useTelemetryValues('CarIdxLap')?.[carIdx] as number;
  const sessionType = useCurrentSessionType();
  const lapDistPct = useTelemetryValue('LapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const avgLapTimes = useCarIdxAverageLapTime();
  const avgLapTime = avgLapTimes[carIdx];
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const isFixedLapRace = totalLaps > 0;
  const result = {
    isFixedLapRace: isFixedLapRace,
    totalRaceLaps: 0,
  };

  // No race, no business
  if (sessionType != 'Race') return result;

  // After checkered: freeze at the lap count captured when the flag was shown
  if (state >= SessionState.Checkered) {
    return { isFixedLapRace: true, totalRaceLaps: currentLap };
  }

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
  } else {
    // Time-limited race, so we have to estimate based on remaining time and expected laptimes
    // In replays, the average lap time is reported as 1s, which is obviously invalid, so we skip
    // the estimation in this case. Fall back to class est lap time when no avg is available yet
    // (e.g. race start without a prior qualifying session).
    const classEstLapTime = classEstLapTimes?.[carIdx];
    const effectiveLapTime =
      avgLapTime !== undefined && avgLapTime > 1
        ? avgLapTime
        : classEstLapTime !== undefined && classEstLapTime > 1
          ? classEstLapTime
          : undefined;

    if (effectiveLapTime !== undefined) {
      if (lap === 0) {
        // Race has not yet started
        result.totalRaceLaps = timeTotal / effectiveLapTime;
      } else {
        // Race has started, so we have to add the number of completed laps and the percentage of the current lap
        result.totalRaceLaps =
          timeRemaining / effectiveLapTime +
          (lap - 1) +
          (carIdxLapDistPct?.[carIdx] ?? 0);
      }
    }
  }
  return result;
};
