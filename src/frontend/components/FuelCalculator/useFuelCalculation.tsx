/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo } from 'react';
import { useTelemetryValues } from '@irdashies/context';
import { useFuelStore } from './FuelStore';
import type { FuelCalculation, FuelLapData } from './types';
import {
  validateLapData,
  calculateWeightedAverage,
  detectLapCrossing,
  isGreenFlag,
  calculateConfidence,
} from './fuelCalculations';

export function useFuelCalculation(
  safetyMargin: number = 0.05
): FuelCalculation | null {
  const fuelLevel = useTelemetryValues('FuelLevel')?.[0];
  const fuelLevelPct = useTelemetryValues('FuelLevelPct')?.[0];
  const lap = useTelemetryValues('Lap')?.[0];
  const lapDistPct = useTelemetryValues('LapDistPct')?.[0];
  const sessionLapsRemain = useTelemetryValues('SessionLapsRemain')?.[0];
  const sessionTimeRemain = useTelemetryValues('SessionTimeRemain')?.[0];
  const sessionFlags = useTelemetryValues('SessionFlags')?.[0];
  const sessionTime = useTelemetryValues('SessionTime')?.[0];
  const sessionNum = useTelemetryValues('SessionNum')?.[0];
  const sessionLaps = useTelemetryValues('SessionLaps')?.[0];

  const store = useFuelStore();

  // Debug logging
  // useEffect(() => {
  //   console.log('[FuelCalculator] Telemetry values:', {
  //     fuelLevel,
  //     lap,
  //     lapDistPct,
  //     sessionLapsRemain,
  //     sessionTime,
  //     sessionNum,
  //   });
  // }, [fuelLevel, lap, lapDistPct, sessionLapsRemain, sessionTime, sessionNum]);

  // Update session info (clears data on session change)
  useEffect(() => {
    if (sessionNum !== undefined) {
      store.updateSessionInfo(sessionNum);
    }
  }, [sessionNum, store]);

  // Detect lap crossings and process fuel data
  useEffect(() => {
    if (
      lapDistPct === undefined ||
      fuelLevel === undefined ||
      sessionTime === undefined ||
      lap === undefined ||
      sessionFlags === undefined
    )
      return;

    const state = useFuelStore.getState();

    // Detect lap crossing
    if (detectLapCrossing(lapDistPct, state.lastLapDistPct)) {
      const fuelUsed = state.lapStartFuel - fuelLevel;
      const lapTime = sessionTime - state.lapCrossingTime;

      // console.log('[FuelCalculator] Lap crossing detected!', {
      //   lapNumber: lap - 1,
      //   fuelUsed,
      //   lapTime,
      //   startFuel: state.lapStartFuel,
      //   endFuel: fuelLevel,
      // });

      // Validate and store lap data
      if (fuelUsed > 0 && lapTime > 0) {
        const recentLaps = state.getLapHistory().slice(0, 10);
        const isValid = validateLapData(fuelUsed, lapTime, recentLaps);

        const lapData: FuelLapData = {
          lapNumber: lap - 1,
          fuelUsed,
          lapTime,
          isGreenFlag: isGreenFlag(sessionFlags),
          isValidForCalc: isValid,
          timestamp: Date.now(),
        };

        // console.log('[FuelCalculator] Storing lap data:', lapData);
        store.addLapData(lapData);
      } else {
        // console.warn('[FuelCalculator] Invalid lap data:', { fuelUsed, lapTime });
      }

      // Update lap crossing state
      store.updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap);
    } else if (state.lastLapDistPct === 0) {
      // Initialize on first telemetry
      // console.log('[FuelCalculator] Initializing lap tracking');
      store.updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap);
    }
  }, [lapDistPct, fuelLevel, sessionTime, lap, sessionFlags, store]);

  // Calculate fuel metrics
  const calculation = useMemo((): FuelCalculation | null => {
    if (
      fuelLevel === undefined ||
      lap === undefined ||
      sessionLapsRemain === undefined ||
      sessionLaps === undefined
    ) {
      // console.log('[FuelCalculator] Missing required telemetry for calculations');
      return null;
    }

    const lapHistory = store.getLapHistory();
    // console.log('[FuelCalculator] Lap history count:', lapHistory.length);

    // Need at least 2 laps for calculations
    if (lapHistory.length < 2) {
      // console.log('[FuelCalculator] Need at least 2 laps for calculations (current:', lapHistory.length, ')');
      return null;
    }

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return null;

    // Get different lap groupings
    const greenLaps = validLaps.filter((l) => l.isGreenFlag);
    const last3 = validLaps.slice(0, 3);
    const last10 = validLaps.slice(0, 10);

    // Calculate averages
    const lastLapUsage = validLaps[0]?.fuelUsed || 0;
    const avg3Laps = calculateWeightedAverage(last3);
    const avg10Laps = calculateWeightedAverage(last10);
    const avgAllGreenLaps = calculateWeightedAverage(greenLaps);

    // Use 10-lap average as primary metric, fall back to 3-lap if needed
    const avgFuelPerLap = last10.length >= 5 ? avg10Laps : avg3Laps;

    // Calculate laps possible with current fuel
    const lapsWithFuel = Math.floor(fuelLevel / avgFuelPerLap);

    // Determine laps remaining
    let lapsRemaining = sessionLapsRemain;
    let totalLaps = sessionLaps;

    // For timed races (SessionLapsRemain = 32767), estimate from time
    if (
      sessionTimeRemain !== undefined &&
      sessionTimeRemain > 0 &&
      sessionLapsRemain === 32767
    ) {
      const avgLapTime =
        validLaps.reduce((sum, l) => sum + l.lapTime, 0) / validLaps.length;
      lapsRemaining = Math.ceil(sessionTimeRemain / avgLapTime) + 1;
      totalLaps = lap + lapsRemaining;
    }

    // Calculate fuel needed with safety margin
    const fuelNeeded = lapsRemaining * avgFuelPerLap * (1 + safetyMargin);
    const canFinish = fuelLevel >= fuelNeeded;
    const fuelToAdd = Math.max(0, fuelNeeded - fuelLevel);

    // Calculate pit window
    const pitWindowOpen = lap + 1;
    const pitWindowClose = lap + lapsWithFuel - 1;

    // Target consumption for fuel saving
    const targetConsumption =
      lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

    // Calculate confidence
    const confidence = calculateConfidence(validLaps.length);

    const result = {
      fuelLevel,
      lastLapUsage,
      avg3Laps,
      avg10Laps,
      avgAllGreenLaps,
      lapsWithFuel,
      lapsRemaining,
      totalLaps,
      currentLap: lap,
      fuelToFinish: fuelNeeded,
      fuelToAdd,
      pitWindowOpen,
      pitWindowClose,
      canFinish,
      targetConsumption,
      confidence,
    };

    // console.log('[FuelCalculator] Calculation result:', result);
    return result;
  }, [
    fuelLevel,
    lap,
    sessionLapsRemain,
    sessionLaps,
    sessionTimeRemain,
    store,
    safetyMargin,
  ]);

  return calculation;
}
