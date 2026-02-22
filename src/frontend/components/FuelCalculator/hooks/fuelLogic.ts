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
import { calculateFuelAlerts } from './useFuelAlerts';

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
  sessionType?: string;
  totalSessionLaps?: number; // Official session laps (from race info)
  estLapTime?: number; // Estimated lap time for the car/class
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
  sessionType,
  totalSessionLaps,
  estLapTime,
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
        const isQualifying =
          sessionType === 'Lone Qualify' || sessionType === 'Open Qualify';
        const isValid =
          !nextInternalState.wasTowedDuringLap && (isGreen || isQualifying);

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

        // Track qualifying consumption
        if (isQualifying) {
          const currentMax = fuelStore.qualifyConsumption || 0;
          if (fuelUsed > currentMax) {
            actions.setQualifyConsumption = fuelUsed;
          }
        }
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
  // PERFORMANCE: If we just added a lap, inject it into the local calculation array
  // so the statistics (AVG, MIN, MAX, LAST) update IMMEDIATELY without waiting
  // for the next store update cycle.
  let lapHistory = fuelStore.getLapHistory();
  let qMax = fuelStore.qualifyConsumption;

  if (actions.addLapData) {
    lapHistory = [actions.addLapData, ...lapHistory];
  }
  if (actions.setQualifyConsumption !== undefined) {
    qMax = actions.setQualifyConsumption;
  }

  const validLaps = lapHistory.filter((l) => l.isValidForCalc);
  const fullLaps = validLaps.filter((l) => !l.isOutLap && !l.isInLap);
  const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;

  // Tank Capacity
  let fuelTankCapacity = 60;
  if (fuelLevel && fuelLevelPct && fuelLevelPct > 0.01 && fuelLevelPct < 0.99) {
    fuelTankCapacity = fuelLevel / fuelLevelPct;
  }

  const lastLapUsage = lapHistory.length > 0 ? lapHistory[0].fuelUsed : 0;
  const avgLapsCount = settings?.avgLapsCount || 5;
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

  // Use the same recent-lap window for lap time as for fuel consumption.
  // Using ALL laps can skew the estimate with slow early/formation laps,
  // causing lapsRemaining to be underestimated for timed-race sessions.
  const recentLaps = lapsToUse.slice(0, avgLapsCount);
  const avgLapTime = calculateAvgLapTime(recentLaps) || estLapTime || 0;
  const lapsWithFuel =
    trendAdjustedConsumption > 0 ? fuelLevel / trendAdjustedConsumption : 0;

  // Laps Remaining
  // SessionLapsRemain counts the *current* in-progress lap as a full lap remaining.
  // We subtract lapDistPct (fraction of current lap already driven) to get the true distance remaining.
  // IMPORTANT: At lap crossing, `Lap` increments in the same telemetry frame but `SessionLapsRemain`
  // may NOT have decremented yet (1-frame SDK lag). We cap using the official totalSessionLaps
  // to avoid counting 1 lap too many during the snapshot at crossing.
  let lapsRemaining = 0;
  let rawTimeFractionForDisplay: number | undefined;
  if (
    sessionLapsRemain !== undefined &&
    sessionLapsRemain > 0 &&
    sessionLapsRemain < 32767
  ) {
    let lr = sessionLapsRemain - lapDistPct;
    // Cap: laps remaining cannot exceed (totalSessionLaps - completedLaps)
    // completedLaps = lap - 1 (laps fully completed so far)
    if (totalSessionLaps && totalSessionLaps > 0 && totalSessionLaps < 32767) {
      const completedLaps = lap - 1;
      lr = Math.min(lr, totalSessionLaps - completedLaps);
    }
    lapsRemaining = Math.max(0, lr);
  } else if (sessionTimeRemain !== undefined && sessionTimeRemain > 0) {
    // For timed races, SessionTimeRemain is the time until the session clock hits 0
    // (when the white flag/checkered is shown). However, iRacing mandates that ALL
    // drivers complete the lap they're currently on when the timer expires.
    // This means the actual laps remaining = ceil(lapDistPct + timeRemain/avgLapTime) - lapDistPct.
    //
    // Without the ceil: 5.68 laps predicted, but 6 actually run (0.32 laps undercount)
    // With the ceil:    ceil(0.01 + 5.68) - 0.01 = 6 - 0.01 = 5.99 ≈ 6 ✓
    //
    // iRacing also returns 604800 (1 week) before the race has actually started/timer counting down.
    // If the time is that large, we fall back to the totalSessionTime which is the allocated race time.
    const effectiveTimeRemain =
      sessionTimeRemain > 600000 &&
      sessionTimeTotal !== undefined &&
      sessionTimeTotal > 0 &&
      sessionTimeTotal < 600000
        ? sessionTimeTotal
        : sessionTimeRemain;

    const lapTime = avgLapTime || 100;
    const timeFraction = effectiveTimeRemain / lapTime;
    lapsRemaining = Math.ceil(lapDistPct + timeFraction) - lapDistPct;

    // For IN RACE display: use estLapTime from session info when fewer than 3 laps have
    // been recorded, so the total laps estimate is stable from lap 0 (not just after 5 laps).
    // estLapTime comes from CarClassEstLapTime and is calibrated per car/track.
    const lapTimeForDisplay =
      recentLaps.length >= 3 ? lapTime : estLapTime || lapTime;
    rawTimeFractionForDisplay =
      effectiveTimeRemain / lapTimeForDisplay - lapDistPct;
  }

  // totalLaps: use raw float for display so header shows "X / 5.68" for timed races
  // while lapsRemaining (ceil-based) is used for accurate refuel calculations.
  const totalLaps =
    totalSessionLaps && totalSessionLaps > 0 && totalSessionLaps < 32767
      ? totalSessionLaps
      : rawTimeFractionForDisplay !== undefined
        ? lap + rawTimeFractionForDisplay
        : lap + lapsRemaining - (1 - lapDistPct);

  const fuelNeededToFinish = Math.max(
    0,
    lapsRemaining * trendAdjustedConsumption - fuelLevel
  );

  const { fuelStatus, gridWarning } = calculateFuelAlerts({
    fuelLevelPct,
    sessionType,
    fuelLevel,
    trendAdjustedConsumption,
    maxLapUsage: findFuelMinMax(lapsToUse).max,
    minLapUsage: findFuelMinMax(lapsToUse).min,
    lastLapUsage,
    lapsRemaining,
    sessionState,
    tankCapacity: fuelTankCapacity,
    fuelNeeded: fuelNeededToFinish,
    settings,
  });

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
    maxQualify: qMax,
    lapsWithFuel,
    lapsRemaining,
    totalLaps,
    currentLap: lap,
    fuelToFinish: fuelNeededToFinish,
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
    targetScenarios: (() => {
      const scenarios: {
        laps: number;
        fuelPerLap: number;
        isCurrentTarget: boolean;
      }[] = [];
      const baseLaps = Math.floor(lapsWithFuel);
      if (fuelLevel > 0 && baseLaps > 0) {
        if (baseLaps > 1) {
          scenarios.push({
            laps: baseLaps - 1,
            fuelPerLap: fuelLevel / (baseLaps - 1),
            isCurrentTarget: false,
          });
        }
        scenarios.push({
          laps: baseLaps,
          fuelPerLap: fuelLevel / baseLaps,
          isCurrentTarget: true,
        });
        scenarios.push({
          laps: baseLaps + 1,
          fuelPerLap: fuelLevel / (baseLaps + 1),
          isCurrentTarget: false,
        });
      }
      return scenarios;
    })(),
    earliestPitLap: 0,
    fuelTankCapacity,
    fuelStatus,
    lapsRange: [0, 0],
    gridWarning,
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
