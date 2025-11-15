/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo } from 'react';
import { useTelemetryValues, useSessionLaps, useTelemetry } from '@irdashies/context';
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
  safetyMargin = 0.05
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
  const sessionLaps = useSessionLaps(sessionNum);

  // Get race leader's lap for multi-class racing
  const carIdxLap = useTelemetry('CarIdxLap');
  const carIdxPosition = useTelemetry('CarIdxPosition');

  const updateSessionInfo = useFuelStore((state) => state.updateSessionInfo);
  const addLapData = useFuelStore((state) => state.addLapData);
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const updateLapDistPct = useFuelStore((state) => state.updateLapDistPct);

  // Debug logging - disabled
  // useEffect(() => {
  //   if (lapDistPct !== undefined && lapDistPct > 0.85) {
  //     const state = useFuelStore.getState();
  //     console.log(
  //       `[FuelCalculator] Near finish - lap:${lap} dist:${lapDistPct.toFixed(3)} lastDist:${state.lastLapDistPct.toFixed(3)} fuel:${fuelLevel?.toFixed(2)} startFuel:${state.lapStartFuel.toFixed(2)}`
  //     );
  //   }
  // }, [fuelLevel, lap, lapDistPct]);

  // Update session info (clears data on session change)
  useEffect(() => {
    if (sessionNum !== undefined) {
      updateSessionInfo(sessionNum);
    }
  }, [sessionNum, updateSessionInfo]);

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

    // Detect lap crossing - when lap distance goes from >0.9 to <0.1
    if (detectLapCrossing(lapDistPct, state.lastLapDistPct)) {
      const fuelUsed = state.lapStartFuel - fuelLevel;
      const lapTime = sessionTime - state.lapCrossingTime;

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

        addLapData(lapData);
      }

      // Now update lap crossing state for the NEW lap
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap);
    } else if (state.lastLapDistPct === 0) {
      // Initialize on first telemetry
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap);
    } else {
      // Always update distance to track lap crossing properly
      updateLapDistPct(lapDistPct);
    }
  }, [
    lapDistPct,
    fuelLevel,
    sessionTime,
    lap,
    sessionFlags,
    addLapData,
    updateLapCrossing,
    updateLapDistPct,
  ]);

  // Calculate fuel metrics
  const calculation = useMemo((): FuelCalculation | null => {
    if (
      fuelLevel === undefined ||
      fuelLevelPct === undefined ||
      lap === undefined ||
      sessionLapsRemain === undefined ||
      sessionLaps === undefined
    ) {
      return null;
    }

    const lapHistory = useFuelStore.getState().getLapHistory();

    // Need at least 1 lap for calculations
    if (lapHistory.length < 1) {
      return null;
    }

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return null;

    // Calculate tank capacity from current fuel level and percentage
    const fuelTankCapacity = fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : 60; // Default to 60L if can't calculate

    // Get different lap groupings
    const greenLaps = validLaps.filter((l) => l.isGreenFlag);
    const last3 = validLaps.slice(0, 3);
    const last10 = validLaps.slice(0, 10);

    // Calculate averages
    const lastLapUsage = validLaps[0]?.fuelUsed || 0;
    const avg3Laps = calculateWeightedAverage(last3);
    const avg10Laps = calculateWeightedAverage(last10);
    const avgAllGreenLaps = calculateWeightedAverage(greenLaps);

    // Calculate min and max fuel consumption from valid laps
    const minLapUsage = validLaps.length > 0
      ? Math.min(...validLaps.map(l => l.fuelUsed))
      : 0;
    const maxLapUsage = validLaps.length > 0
      ? Math.max(...validLaps.map(l => l.fuelUsed))
      : 0;

    // Use 10-lap average as primary metric, fall back to 3-lap if needed
    const avgFuelPerLap = last10.length >= 5 ? avg10Laps : avg3Laps;

    // Calculate laps possible with current fuel
    const lapsWithFuel = Math.floor(fuelLevel / avgFuelPerLap);

    // Determine laps remaining
    let lapsRemaining = sessionLapsRemain;
    let totalLaps = typeof sessionLaps === 'string' ? parseInt(sessionLaps, 10) : sessionLaps || 0;

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

    // For lap-based races, account for race leader in multi-class racing
    // Find the leader (position 1) and their lap number
    if (carIdxPosition?.value && carIdxLap?.value && sessionLapsRemain !== 32767) {
      const leaderCarIdx = carIdxPosition.value.findIndex((pos) => pos === 1);
      if (leaderCarIdx !== -1) {
        const leaderLap = carIdxLap.value[leaderCarIdx];
        if (leaderLap !== undefined && totalLaps > 0) {
          // Leader's laps remaining
          const leaderLapsRemaining = totalLaps - leaderLap;
          // Use the minimum of your laps remaining or leader's laps remaining
          // This accounts for being lapped - race ends when leader finishes
          lapsRemaining = Math.min(lapsRemaining, leaderLapsRemaining);
        }
      }
    }

    // Calculate fuel needed with safety margin
    const fuelNeeded = lapsRemaining * avgFuelPerLap * (1 + safetyMargin);
    const canFinish = fuelLevel >= fuelNeeded;
    // Cap fuel to add at tank capacity (can't add more than tank can hold)
    const fuelToAdd = Math.max(0, Math.min(fuelTankCapacity, fuelNeeded) - fuelLevel);

    // Calculate pit window
    const pitWindowOpen = lap + 1;
    const pitWindowClose = lap + lapsWithFuel - 1;

    // Target consumption for fuel saving
    const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

    // Calculate fuel at finish (current fuel - fuel needed for remaining laps)
    const fuelAtFinish = fuelLevel - (lapsRemaining * avgFuelPerLap);

    // Calculate confidence
    const confidence = calculateConfidence(validLaps.length);

    const result = {
      fuelLevel,
      lastLapUsage,
      avg3Laps,
      avg10Laps,
      avgAllGreenLaps,
      minLapUsage,
      maxLapUsage,
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
      fuelAtFinish,
    };

    // console.log('[FuelCalculator] Calculation result:', result);
    return result;
  }, [
    fuelLevel,
    fuelLevelPct,
    lap,
    sessionLapsRemain,
    sessionLaps,
    sessionTimeRemain,
    safetyMargin,
    carIdxPosition?.value,
    carIdxLap?.value,
  ]);

  return calculation;
}
