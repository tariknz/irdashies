import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
  useCurrentSessionType,
  useFocusCarIdx,
  useTelemetryValue,
  useCarIdxClassEstLapTime,
  useTelemetryValues
} from '@irdashies/context';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export function useTotalRaceLaps(): number | null {
  const carIdx = useFocusCarIdx() as number;
  const { timeRemaining, timeTotal, totalLaps } = useSessionLapCount();
  const lap = useTelemetryValue("Lap") as number;
  const sessionType = useCurrentSessionType();
  const lapDistPct = useTelemetryValue('LapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  // TODO: Switch to useCarIdxAverageLapTime()
  const avgLapTime = useCarIdxClassEstLapTime()?.[carIdx];

  // No race, no business
  if (sessionType != 'Race')
    return null;

  if (totalLaps > 0) {
    // Easy case, fixed lap count. We just have to account for the race leader that might have lapped us
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
      leaderLap > 0 &&
      lapDistPct !== undefined
    ) {
      let lapDiff = leaderLap - lap;

      // Sanity check
      if ((lapDiff < 0) || (lapDiff > totalLaps)) {
        return totalLaps;
      }

      // If the leader is n laps ahead, but behind us on track, he actually lapped us only n-1 times
      if (lapDiff > 0) {
        if (lapDistPct > leaderLapDistPct) {
          lapDiff--;
        }
      }
      return totalLaps - lapDiff;
    }
    return totalLaps;
  }
  else {
    // Time-limited race, so we have to estimate based on remaining time and expected laptimes
    // In replays, the average lap time is reported as 1s, which is obviously invalid, so we skip
    // the estimation in this case
    if (avgLapTime !== undefined && avgLapTime > 1) {
      if (lap === 0) {
        // Race has not yet started
        return (timeTotal / avgLapTime);
      }
      if (lapDistPct !== undefined) {
        // Race has started, so we have to add the number of completed laps and the percentage of the current lap
        return ((timeRemaining / avgLapTime) + (lap - 1) + lapDistPct);
      }
    }
    return null;
  }
}