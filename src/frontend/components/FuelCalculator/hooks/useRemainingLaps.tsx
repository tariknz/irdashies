import { useTotalRaceLaps } from '@irdashies/context';
import { isFinalLap } from '../fuelCalculations';

const TIMED_RACE_LAPS_REMAINING = 32767;
const MAX_REASONABLE_LAPS = 5000;

interface UseRemainingLapsProps {
  sessionLapsRemain: number | undefined;
  sessionTimeRemain: number | undefined;
  lap: number | undefined;
  lapDistPct: number | undefined;
  avgLapTime: number;
  trendAdjustedConsumption: number;
  fuelLevel: number | undefined;
  sessionFlags: number | undefined;
  sessionLaps: number | string | undefined;
}

export function useRemainingLaps({
  sessionLapsRemain,
  sessionTimeRemain,
  lap,
  lapDistPct,
  avgLapTime,
  trendAdjustedConsumption,
  fuelLevel,
  sessionFlags,
  sessionLaps,
}: UseRemainingLapsProps) {
  const { totalRaceLaps: calculatedTotalRaceLaps } = useTotalRaceLaps();

  // Calculate remaining distance in current lap
  const currentLapRemainingPct = Math.max(0, 1 - (lapDistPct || 0));

  let lapsRemaining = (sessionLapsRemain || 0) + currentLapRemainingPct;
  let lapsRemainingRefuel = (sessionLapsRemain || 0) + currentLapRemainingPct;

  let totalLaps =
    typeof sessionLaps === 'string'
      ? parseInt(sessionLaps, 10)
      : sessionLaps || 0;

  // Check for white/checkered flag
  if (sessionFlags !== undefined && isFinalLap(sessionFlags)) {
    const remainingDistance = Math.max(0, 1 - (lapDistPct || 0));
    lapsRemaining = remainingDistance;
    lapsRemainingRefuel = remainingDistance;
    totalLaps = (lap || 0) + 1;
  } else if (sessionLapsRemain === TIMED_RACE_LAPS_REMAINING) {
    // Timed Race Logic
    if (calculatedTotalRaceLaps > 0 && lap !== undefined) {
      // Use the hook's result directly
      totalLaps = Math.ceil(calculatedTotalRaceLaps);
      lapsRemaining = Math.max(0, totalLaps - (lap - 1) - (lapDistPct || 0));

      // Add safety buffer for refuel calculations
      const TIME_PADDING_REFUEL = 45.0;
      const avgLapTimeForBuffer = avgLapTime > 0 ? avgLapTime : 90; // Default 90s if unknown
      const bufferLaps = TIME_PADDING_REFUEL / avgLapTimeForBuffer;
      lapsRemainingRefuel = lapsRemaining + bufferLaps;
    } else if (
      sessionTimeRemain !== undefined &&
      sessionTimeRemain > 0 &&
      lap !== undefined
    ) {
      // Fallback to local calculation
      const projectionLapTime = avgLapTime > 0 ? avgLapTime : 90;

      const timeAtLine =
        sessionTimeRemain - projectionLapTime * currentLapRemainingPct;
      const TIME_PADDING_SECONDS = 0.5;
      const TIME_PADDING_REFUEL = 45.0;

      let futureLaps = 0;
      let futureLapsRefuel = 0;

      if (timeAtLine < -TIME_PADDING_SECONDS) {
        lapsRemaining = 1; // Current lap is last
        futureLaps = 0;
      } else {
        futureLaps = Math.ceil(
          (timeAtLine + TIME_PADDING_SECONDS) / projectionLapTime
        );
        futureLaps = Math.max(0, futureLaps);
        lapsRemaining = 1 + futureLaps;
      }
      totalLaps = lap + futureLaps;

      if (timeAtLine < -TIME_PADDING_REFUEL) {
        lapsRemainingRefuel = 1;
      } else {
        futureLapsRefuel = Math.ceil(
          (timeAtLine + TIME_PADDING_REFUEL) / projectionLapTime
        );
        futureLapsRefuel = Math.max(0, futureLapsRefuel);
        lapsRemainingRefuel = 1 + futureLapsRefuel;
      }
    } else {
      // Fallback or Timer ended
      if (sessionTimeRemain === -1) {
        // Infinite time? Fallback to fuel estimate
        const estimatedLapsFromFuel =
          trendAdjustedConsumption > 0 && fuelLevel !== undefined
            ? Math.floor(fuelLevel / trendAdjustedConsumption)
            : 0;
        lapsRemaining = Math.max(1, Math.min(estimatedLapsFromFuel, 50));
        lapsRemainingRefuel = lapsRemaining;
        if (lap !== undefined) totalLaps = lap + lapsRemaining;
      } else {
        // Timer <= 0
        const remainingDistance = Math.max(0, 1 - (lapDistPct || 0));
        lapsRemaining = remainingDistance;
        lapsRemainingRefuel = lapsRemaining;
        if (lap !== undefined) totalLaps = lap + 1;
      }
    }
  } else {
    // Not a timed race, sync refuel count
    lapsRemainingRefuel = lapsRemaining;
  }

  // Sanity Checks
  if (lapsRemaining > 1000) {
    lapsRemaining = 1000;
    lapsRemainingRefuel = 1000;
  }

  if (
    !Number.isFinite(lapsRemaining) ||
    lapsRemaining < 0 ||
    lapsRemaining > MAX_REASONABLE_LAPS
  ) {
    if (
      sessionLapsRemain !== TIMED_RACE_LAPS_REMAINING &&
      sessionLapsRemain !== undefined
    ) {
      lapsRemaining = sessionLapsRemain;
      lapsRemainingRefuel = sessionLapsRemain;
    } else {
      lapsRemaining = 0;
      lapsRemainingRefuel = 0;
    }
  }

  return {
    lapsRemaining,
    lapsRemainingRefuel,
    totalLaps,
  };
}
