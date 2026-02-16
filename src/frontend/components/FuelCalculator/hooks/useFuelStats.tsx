import { FuelCalculatorSettings, FuelLapData } from '../types';
import {
  calculateSimpleAverage,
  calculateAvgLapTime,
  findFuelMinMax,
  getGreenFlagLaps,
} from '../fuelCalculations';

const DEFAULT_TANK_CAPACITY = 60;

interface UseFuelStatsProps {
  lapHistory: FuelLapData[];
  fuelLevel: number | undefined;
  fuelLevelPct: number | undefined;
  fuelTankCapacityFromSession: number | undefined;
  currentLapUsage: number;
  lapDistPct: number | undefined;
  storeLastLapUsage: number;
  qualifyConsumption: number | null;
  settings?: FuelCalculatorSettings;
}

export function useFuelStats({
  lapHistory,
  fuelLevel,
  fuelLevelPct,
  fuelTankCapacityFromSession,
  currentLapUsage,
  lapDistPct,
  storeLastLapUsage,
  qualifyConsumption,
  settings,
}: UseFuelStatsProps) {
  const validLaps = lapHistory.filter((l) => l.isValidForCalc);
  // If no valid laps, return partial/safe defaults?
  // We'll return what we can.

  // --- 1. Tank Capacity ---
  const calculateRealTankCapacity = () => {
    // Priority 1: Session data
    if (fuelTankCapacityFromSession && fuelTankCapacityFromSession > 0) {
      return fuelTankCapacityFromSession;
    }

    // Priority 2: Estimate from maximum observed
    // const maxObservedFuel = Math.max(...) - UNUSED

    // Priority 3: Use fuelLevelPct with verification
    if (
      fuelLevel &&
      fuelLevelPct &&
      fuelLevelPct > 0.01 &&
      fuelLevelPct < 0.99
    ) {
      const calculated = fuelLevel / fuelLevelPct;
      if (calculated > fuelLevel * 1.1 && calculated < fuelLevel * 50) {
        // Sanity check
        return Math.min(200, calculated);
      }
    }

    return DEFAULT_TANK_CAPACITY;
  };

  const fuelTankCapacity = calculateRealTankCapacity();

  // --- 2. Filter Laps ---
  const fullLaps = validLaps.filter((l) => !l.isOutLap && !l.isInLap);
  const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;

  // --- 3. Averages ---
  const greenLaps = getGreenFlagLaps(lapsToUse);
  const avgLapsCount = settings?.avgLapsCount || 3;
  const lastLapsForAvg = lapsToUse.slice(0, avgLapsCount);
  const last10 = lapsToUse.slice(0, 10);

  // Last lap usage
  const lastLapUsage =
    storeLastLapUsage > 0
      ? storeLastLapUsage
      : lapHistory.length > 0
        ? lapHistory[0].fuelUsed
        : 0;

  const avgLaps =
    lastLapsForAvg.length > 0
      ? calculateSimpleAverage(lastLapsForAvg)
      : lastLapUsage;
  const avg10Laps =
    last10.length > 0 ? calculateSimpleAverage(last10) : avgLaps;
  const avgAllGreenLaps =
    greenLaps.length > 0 ? calculateSimpleAverage(greenLaps) : avg10Laps;

  // --- 4. Min/Max ---
  // Exclude historical laps for min/max to be session-relevant
  const validSessionLaps = validLaps.filter((l) => !l.isHistorical);
  const maxSourceLaps =
    validSessionLaps.length > 0 ? validSessionLaps : validLaps;
  const { min: minLapUsage, max: maxLapUsage } = findFuelMinMax(maxSourceLaps);

  // --- 5. Primary Consumption Logic ---
  let avgFuelPerLapBase = avgLaps;
  let avgFuelPerLapForConsumption = avgLaps;

  // FALLBACK: If no valid laps yet
  if (avgFuelPerLapBase <= 0) {
    if (qualifyConsumption && qualifyConsumption > 0) {
      avgFuelPerLapBase = qualifyConsumption;
      avgFuelPerLapForConsumption = qualifyConsumption;
    } else if (lapsToUse.length > 0 && lapsToUse[0].isHistorical) {
      const historicalAvg = calculateSimpleAverage(lapsToUse.slice(0, 5));
      if (historicalAvg > 0) {
        avgFuelPerLapBase = historicalAvg;
        avgFuelPerLapForConsumption = historicalAvg;
      }
    }
  }

  // Emergency Live Estimation (First Lap)
  if (avgFuelPerLapBase <= 0) {
    if (currentLapUsage > 0 && (lapDistPct || 0) > 0.05) {
      let liveProj = currentLapUsage / (lapDistPct || 1);
      // Loose sanity clamps (0.5L to 20L per lap)
      liveProj = Math.max(0.5, Math.min(20.0, liveProj));

      avgFuelPerLapBase = liveProj;
      avgFuelPerLapForConsumption = liveProj;
    }
  }

  // --- 6. Consumption Trend ---
  const getConsumptionTrend = () => {
    if (lapsToUse.length < 4) return 0;
    const recent = lapsToUse.slice(0, 3);
    const older = lapsToUse.slice(3, 6);
    if (older.length === 0) return 0;
    const recentAvg = calculateSimpleAverage(recent);
    const olderAvg = calculateSimpleAverage(older);
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  };

  const consumptionTrend = getConsumptionTrend();

  // Apply trend-based adjustment to consumption estimate
  // Only apply positive trends? The original code said:
  // avgFuelPerLapForConsumption * (1 + Math.max(0, consumptionTrend) / 100);
  // Wait, the user request says: "Apply consumption trend bidirectionally - Currently only positive trends are applied"
  // I should fix that now since I'm here.
  // The previous code was: Math.max(0, consumptionTrend)
  // To enable bidirectional, I remove Math.max(0, ...).
  // But negative trend means improving efficiency (less fuel used).
  // If we apply negative trend, we might underestimate fuel usage if efficiency drops back.
  // A conservative calculator usually ignores positive efficiency gains (negative trend) for safety.
  // However, if the user explicitly requested it, I should implement it or at least support it.
  // The request was formulated as an improvement opportunity.
  // "Apply consumption trend bidirectionally — Currently only positive trends are applied (line 1010), ignoring fuel saving improvements"
  // So if consumptionTrend is negative (saving fuel), we should multiply by (1 - x).
  // E.g. trend = -5%. Factor = 0.95.
  // This reduces the 'trendAdjustedConsumption', making 'fuelNeeded' lower.
  // This is risky. If I save fuel for 3 laps, then push, I might run out if calculator assumed I'd keep saving.
  // But if the user WANTS to see the effect of saving, we should show it.
  // I will stick to the safe approach for now (positive only) or maybe dampen the negative trend?
  // The task list item "Apply consumption trend bidirectionally" is marked as Medium Priority.
  // I will implement it now as it's easy. I'll just remove the Math.max(0).
  // Wait, I am in EXECUTION mode for "High Priority".
  // I should stick to High Priority items.
  // High Priority: "Refactor `useFuelCalculation`".
  // I will leave the trend logic AS IS (Positive Only) to avoid scope creep, but mark the location.

  const trendAdjustedConsumption =
    avgFuelPerLapForConsumption * (1 + Math.max(0, consumptionTrend) / 100);

  // --- 7. Avg Lap Time ---
  let avgLapTime = calculateAvgLapTime(lapsToUse);

  if (avgLapTime <= 0) {
    const historicalLaps = lapHistory.filter(
      (l) => l.isHistorical && !l.isOutLap && !l.isInLap
    );
    if (historicalLaps.length > 0) {
      avgLapTime = calculateAvgLapTime(historicalLaps.slice(0, 5));
    }
  }

  // --- 8. Laps With Fuel ---
  const lapsWithFuel =
    trendAdjustedConsumption > 0 && fuelLevel !== undefined
      ? fuelLevel / trendAdjustedConsumption
      : 0;

  return {
    fuelTankCapacity,
    avgLaps,
    avg10Laps,
    avgAllGreenLaps,
    lastLapUsage,
    minLapUsage,
    maxLapUsage,
    trendAdjustedConsumption,
    avgLapTime,
    lapsWithFuel,
    avgFuelPerLapBase, // Passed as 'avgConsumption' to projection
    validLapsCount: validLaps.length,
    validLaps, // Exposed if needed
    lapsToUse,
  };
}
