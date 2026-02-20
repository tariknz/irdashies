import { FuelCalculation, FuelCalculatorSettings, FuelLapData } from '../types';
import {
  detectLapCrossing,
  isGreenFlag,
  isCheckeredFlag,
  calculateSimpleAverage,
  calculateAvgLapTime,
  findFuelMinMax,
  getGreenFlagLaps,
} from '../fuelCalculations';
import { Telemetry } from '@irdashies/types';

export interface FuelInternalState {
  lastSessionTime?: number;
  lastRefuelTime?: number;
  prevFuelLevel?: number;
  wasTowedDuringLap: boolean;
  wasOnPitRoadDuringLap: boolean;
  isLapFullyGreen: boolean;
  prevLapDistPct?: number;
  isLapDistPctReset: boolean;
  isRaceFinished: boolean;
  checkFlagLap: number | null;
}

export const INITIAL_INTERNAL_STATE: FuelInternalState = {
  wasTowedDuringLap: false,
  wasOnPitRoadDuringLap: false,
  isLapFullyGreen: true,
  isLapDistPctReset: false,
  isRaceFinished: false,
  checkFlagLap: null,
};

interface FuelActions {
  addLapData?: FuelLapData;
  addRefuel?: number;
  updateLapCrossing?: {
    lapDistPct: number;
    fuelLevel: number;
    sessionTime: number;
    lap: number;
    onPitRoad: boolean;
  };
  updateLapDistPct?: number;
  setQualifyConsumption?: number | null;
}

interface CalculationInputs {
  telemetry: Telemetry;
  fuelStore: {
    lastLapDistPct: number;
    lastLap: number;
    lapCrossingTime: number;
    lapStartFuel: number;
    accumulatedRefuel: number;
    wasOnPitRoad: boolean;
    qualifyConsumption: number | null;
    getRecentLaps: (count: number) => FuelLapData[];
    getLapHistory: () => FuelLapData[];
  };
  internalState: FuelInternalState;
  settings: FuelCalculatorSettings;
  safetyMargin: number;
}

export function runFuelLogic({
  telemetry,
  fuelStore,
  internalState,
  settings,
}: CalculationInputs): {
  calculation: FuelCalculation | null;
  nextInternalState: FuelInternalState;
  actions: FuelActions;
} {
  const actions: FuelActions = {};
  const nextInternalState = { ...internalState };

  // 1. Extract Telemetry safely
  const fuelLevel = telemetry.FuelLevel?.value?.[0] as number | undefined;
  const fuelLevelPct = telemetry.FuelLevelPct?.value?.[0] as number | undefined;
  const lapNum = telemetry.Lap?.value?.[0] as number | undefined;
  const lapDistPct = telemetry.LapDistPct?.value?.[0] as number | undefined;
  const sessionLapsRemain = telemetry.SessionLapsRemain?.value?.[0] as
    | number
    | undefined;
  const sessionTimeRemain = telemetry.SessionTimeRemain?.value?.[0] as
    | number
    | undefined;
  const sessionTimeTotal = telemetry.SessionTimeTotal?.value?.[0] as
    | number
    | undefined;
  const sessionFlags = telemetry.SessionFlags?.value?.[0] as number | undefined;
  const sessionTime = telemetry.SessionTime?.value?.[0] as number | undefined;
  const sessionNum = telemetry.SessionNum?.value?.[0] as number | undefined;
  const sessionState = telemetry.SessionState?.value?.[0] as number | undefined;
  const onPitRoad = !!telemetry.OnPitRoad?.value?.[0];
  const playerCarTowTime = (telemetry.PlayerCarTowTime?.value?.[0] ??
    0) as number;

  if (
    fuelLevel === undefined ||
    fuelLevelPct === undefined ||
    lapNum === undefined ||
    sessionLapsRemain === undefined ||
    sessionTime === undefined ||
    lapDistPct === undefined
  ) {
    return { calculation: null, nextInternalState, actions };
  }
  const lap = lapNum;

  // 2. Lap Detection & Internal State Updates
  if (lapDistPct !== nextInternalState.prevLapDistPct) {
    if (
      lapDistPct !== undefined &&
      nextInternalState.prevLapDistPct !== undefined
    ) {
      if (lapDistPct < nextInternalState.prevLapDistPct - 0.5) {
        nextInternalState.isLapDistPctReset = true;
      } else if (
        nextInternalState.isLapDistPctReset &&
        lapDistPct > nextInternalState.prevLapDistPct + 0.05
      ) {
        nextInternalState.isLapDistPctReset = false;
      }
    }
    nextInternalState.prevLapDistPct = lapDistPct;
  }

  if (playerCarTowTime > 0) nextInternalState.wasTowedDuringLap = true;
  if (onPitRoad) nextInternalState.wasOnPitRoadDuringLap = true;
  if (sessionFlags !== undefined && !isGreenFlag(sessionFlags)) {
    nextInternalState.isLapFullyGreen = false;
  }

  // Race Finish Monitor
  const isCheckered = isCheckeredFlag(sessionFlags ?? 0);
  const isPostRaceState = sessionState !== undefined && sessionState >= 5;
  if (isCheckered || isPostRaceState) {
    if (nextInternalState.checkFlagLap === null) {
      nextInternalState.checkFlagLap = lap;
      if (
        lapDistPct < 0.05 ||
        (sessionTimeRemain !== undefined &&
          sessionTimeRemain > 300 &&
          isPostRaceState)
      ) {
        nextInternalState.isRaceFinished = true;
      }
    } else if (lap > nextInternalState.checkFlagLap) {
      nextInternalState.isRaceFinished = true;
    }
  } else {
    nextInternalState.checkFlagLap = null;
    nextInternalState.isRaceFinished = false;
  }

  // 3. Lap Crossing & Store Updates (Action Identification)
  const distCrossing = detectLapCrossing(lapDistPct, fuelStore.lastLapDistPct);
  const lapIncremented = lap > fuelStore.lastLap;

  if (lap < fuelStore.lastLap) {
    if (
      nextInternalState.lastSessionTime === undefined ||
      sessionTime > nextInternalState.lastSessionTime
    ) {
      actions.updateLapDistPct = lapDistPct;
    } else {
      actions.updateLapCrossing = {
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap,
        onPitRoad,
      };
    }
  } else {
    const isCrossing =
      distCrossing || (lapIncremented && lap - fuelStore.lastLap === 1);
    if (isCrossing) {
      const timeSinceLastCrossing = sessionTime - fuelStore.lapCrossingTime;
      const completedLap = lap - 1;
      const fuelUsed =
        fuelStore.lapStartFuel + fuelStore.accumulatedRefuel - fuelLevel;

      if (completedLap >= 1 && fuelUsed > 0 && timeSinceLastCrossing >= 10) {
        const isGreen = nextInternalState.isLapFullyGreen;
        const isValid = !nextInternalState.wasTowedDuringLap && isGreen;

        actions.addLapData = {
          lapNumber: completedLap,
          fuelUsed,
          lapTime: timeSinceLastCrossing,
          isGreenFlag: isGreen,
          isValidForCalc: isValid,
          isOutLap: fuelStore.wasOnPitRoad,
          isInLap: nextInternalState.wasOnPitRoadDuringLap,
          wasTowed: nextInternalState.wasTowedDuringLap,
          timestamp: Date.now(),
          sessionNum,
        };
      }
      actions.updateLapCrossing = {
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap: Math.max(lap, completedLap + 1),
        onPitRoad,
      };
      nextInternalState.wasTowedDuringLap = false;
      nextInternalState.wasOnPitRoadDuringLap = false;
      nextInternalState.isLapFullyGreen = isGreenFlag(
        (sessionFlags ?? 0) as number
      );
    } else {
      actions.updateLapDistPct = lapDistPct;
    }
  }
  nextInternalState.lastSessionTime = sessionTime;

  // Refuel Detection
  if (nextInternalState.prevFuelLevel !== undefined) {
    const fuelDelta = fuelLevel - nextInternalState.prevFuelLevel;
    if (
      fuelDelta > 0.05 &&
      sessionTime - (nextInternalState.lastRefuelTime || 0) > 5
    ) {
      actions.addRefuel = fuelDelta;
      nextInternalState.lastRefuelTime = sessionTime;
    }
  }
  nextInternalState.prevFuelLevel = fuelLevel;

  // 4. Calculations (Stats, Strategy, Projections)
  const lapHistory = fuelStore.getLapHistory();
  const validLaps = lapHistory.filter((l) => l.isValidForCalc);
  const fullLaps = validLaps.filter((l) => !l.isOutLap && !l.isInLap);
  const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;

  // Tank Capacity
  let fuelTankCapacity = 60;
  if (fuelLevel && fuelLevelPct && fuelLevelPct > 0.01 && fuelLevelPct < 0.99) {
    fuelTankCapacity = fuelLevel / fuelLevelPct;
  }

  const lastLapUsage = lapHistory.length > 0 ? lapHistory[0].fuelUsed : 0;
  const avgLapsCount = settings?.avgLapsCount || 3;
  const avgLaps =
    lapsToUse.length > 0
      ? calculateSimpleAverage(lapsToUse.slice(0, avgLapsCount))
      : lastLapUsage;

  const currentLapUsage =
    fuelStore.lapStartFuel > 0
      ? Math.max(0, fuelStore.lapStartFuel - fuelLevel)
      : 0;
  let avgFuelPerLapBase = avgLaps;
  if (avgFuelPerLapBase <= 0 && fuelStore.qualifyConsumption)
    avgFuelPerLapBase = fuelStore.qualifyConsumption;
  if (
    avgFuelPerLapBase <= 0 &&
    currentLapUsage > 0 &&
    lapDistPct &&
    lapDistPct > 0.05
  )
    avgFuelPerLapBase = Math.max(
      0.5,
      Math.min(20, currentLapUsage / lapDistPct)
    );

  const trendAdjustedConsumption =
    avgFuelPerLapBase * (1 + settings.safetyMargin / 100);
  const avgLapTime = calculateAvgLapTime(lapsToUse);
  const lapsWithFuel =
    trendAdjustedConsumption > 0 ? fuelLevel / trendAdjustedConsumption : 0;

  // Laps Remaining
  let lapsRemaining = 0;
  if (sessionLapsRemain !== undefined && sessionLapsRemain > 0) {
    lapsRemaining = sessionLapsRemain;
  } else if (sessionTimeRemain !== undefined && sessionTimeRemain > 0) {
    lapsRemaining = sessionTimeRemain / (avgLapTime || 100);
  }
  const totalLaps = lap + lapsRemaining;

  const result: FuelCalculation = {
    fuelLevel,
    lastLapUsage,
    currentLapUsage,
    projectedLapUsage: avgFuelPerLapBase,
    avgLaps,
    avg10Laps: calculateSimpleAverage(lapsToUse.slice(0, 10)) || avgLaps,
    avgAllGreenLaps:
      calculateSimpleAverage(getGreenFlagLaps(lapsToUse)) || avgLaps,
    minLapUsage: findFuelMinMax(lapsToUse).min,
    maxLapUsage: findFuelMinMax(lapsToUse).max,
    maxQualify: fuelStore.qualifyConsumption,
    lapsWithFuel,
    lapsRemaining,
    totalLaps,
    currentLap: lap,
    fuelToFinish: Math.max(
      0,
      lapsRemaining * trendAdjustedConsumption - fuelLevel
    ),
    fuelToAdd: 0,
    pitWindowOpen: 0,
    pitWindowClose: 0,
    canFinish: fuelLevel >= lapsRemaining * trendAdjustedConsumption,
    targetConsumption: 0,
    confidence: 'medium',
    fuelAtFinish: fuelLevel - lapsRemaining * trendAdjustedConsumption,
    avgLapTime,
    sessionTimeTotal: sessionTimeTotal || 0,
    stopsRemaining: 0,
    lapsPerStint: 0,
    targetScenarios: [],
    earliestPitLap: 0,
    fuelTankCapacity,
    fuelStatus: 'safe',
    lapsRange: [0, 0],
    gridWarning: undefined,
    queuedFuel: 0,
  };

  if (nextInternalState.isRaceFinished) {
    return {
      calculation: {
        ...result,
        lapsRemaining: 0,
        canFinish: true,
        fuelStatus: 'safe',
      },
      nextInternalState,
      actions,
    };
  }

  return { calculation: result, nextInternalState, actions };
}
