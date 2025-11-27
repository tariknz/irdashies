/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo } from 'react';
import { useSessionLaps, useTelemetry, useTelemetryValue } from '@irdashies/context';
import { useFuelStore } from './FuelStore';
import type { FuelCalculation, FuelLapData } from './types';
import {
  validateLapData,
  calculateWeightedAverage,
  detectLapCrossing,
  isGreenFlag,
  isWhiteFlag,
  isCheckeredFlag,
  calculateConfidence,
} from './fuelCalculations';

export function useFuelCalculation(
  safetyMargin = 0.05
): FuelCalculation | null {
  const fuelLevel = useTelemetryValue('FuelLevel');
  const fuelLevelPct = useTelemetryValue('FuelLevelPct');
  const lap = useTelemetryValue('Lap');
  const lapDistPct = useTelemetryValue('LapDistPct');
  const sessionLapsRemain = useTelemetryValue('SessionLapsRemain');
  const sessionTimeRemain = useTelemetryValue('SessionTimeRemain');
  const sessionFlags = useTelemetryValue('SessionFlags');
  const sessionTime = useTelemetryValue('SessionTime');
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionLaps = useSessionLaps(sessionNum);
  const onPitRoad = useTelemetryValue('OnPitRoad');

  // Get race leader's lap for multi-class racing
  const carIdxLap = useTelemetry('CarIdxLap');
  const carIdxPosition = useTelemetry('CarIdxPosition');

  const updateSessionInfo = useFuelStore((state) => state.updateSessionInfo);
  const addLapData = useFuelStore((state) => state.addLapData);
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const updateLapDistPct = useFuelStore((state) => state.updateLapDistPct);
  // Subscribe to lapHistory to trigger recalculation when laps are added
  const lapHistoryMap = useFuelStore((state) => state.lapHistory);

  // Debug logging disabled - only lap crossing events are logged below

  // Track current session number (preserves data across session changes)
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
      sessionFlags === undefined ||
      onPitRoad === undefined
    )
      return;

    const state = useFuelStore.getState();

    // Detect lap crossing - when lap distance goes from >0.9 to <0.1
    if (detectLapCrossing(lapDistPct, state.lastLapDistPct)) {
      const fuelUsed = state.lapStartFuel - fuelLevel;
      const lapTime = sessionTime - state.lapCrossingTime;

      console.log(`[FuelCalculator] Lap ${lap - 1} complete - Used: ${fuelUsed.toFixed(3)}L, Time: ${lapTime.toFixed(2)}s, Remaining: ${fuelLevel.toFixed(2)}L, SessionLapsRemain: ${sessionLapsRemain}`);

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
          isOutLap: state.wasOnPitRoad, // Mark if lap started from pit road
          timestamp: Date.now(),
        };

        console.log(`[FuelCalculator]   -> Valid: ${lapData.isValidForCalc}, Green: ${lapData.isGreenFlag}, OutLap: ${lapData.isOutLap}`);

        addLapData(lapData);
      }

      // Now update lap crossing state for the NEW lap
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap, onPitRoad === 1);
    } else if (state.lastLapDistPct === 0) {
      // Initialize on first telemetry
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap, onPitRoad === 1);
    } else {
      // Always update distance to track lap crossing properly
      updateLapDistPct(lapDistPct);
    }
    // sessionLapsRemain is intentionally excluded - only used for logging
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lapDistPct,
    fuelLevel,
    sessionTime,
    lap,
    sessionFlags,
    onPitRoad,
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

    // Convert Map to sorted array (most recent first)
    const lapHistory = Array.from(lapHistoryMap.values()).sort(
      (a, b) => b.lapNumber - a.lapNumber
    );

    // Need at least 1 lap for calculations
    if (lapHistory.length < 1) {
      return null;
    }

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return null;

    // Calculate tank capacity from current fuel level and percentage
    const fuelTankCapacity = fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : 60; // Default to 60L if can't calculate

    // Exclude out-laps and first lap (from grid or after reset) for calculations
    // as they're typically not full racing laps with representative fuel consumption
    const firstLapNumber = validLaps.length > 0
      ? Math.min(...validLaps.map(l => l.lapNumber))
      : 0;
    const fullLaps = validLaps.filter(l => !l.isOutLap && l.lapNumber !== firstLapNumber);

    // Get different lap groupings from full laps (excluding first/out laps)
    const greenLaps = fullLaps.filter((l) => l.isGreenFlag);
    const last3 = fullLaps.slice(0, 3);
    const last10 = fullLaps.slice(0, 10);

    // Calculate averages - use full laps for averages to exclude first/out laps
    // Use fullLaps[0] for lastLapUsage to exclude first/out laps
    const lastLapUsage = fullLaps[0]?.fuelUsed || 0;
    const avg3Laps = last3.length > 0 ? calculateWeightedAverage(last3) : lastLapUsage;
    const avg10Laps = last10.length > 0 ? calculateWeightedAverage(last10) : avg3Laps;
    const avgAllGreenLaps = greenLaps.length > 0 ? calculateWeightedAverage(greenLaps) : avg10Laps;

    // Calculate min and max fuel consumption from full laps
    const minLapUsage = fullLaps.length > 0
      ? Math.min(...fullLaps.map(l => l.fuelUsed))
      : 0;
    const maxLapUsage = fullLaps.length > 0
      ? Math.max(...fullLaps.map(l => l.fuelUsed))
      : 0;

    // Use 10-lap average as primary metric, fall back to 3-lap if needed
    const avgFuelPerLap = last10.length >= 5 ? avg10Laps : avg3Laps;

    // Guard against zero or invalid avgFuelPerLap
    if (avgFuelPerLap <= 0) {
      return null;
    }

    // Calculate average lap time for time until empty (use full laps to exclude first/out laps)
    const avgLapTime = fullLaps.length > 0
      ? fullLaps.reduce((sum, l) => sum + l.lapTime, 0) / fullLaps.length
      : validLaps.length > 0
        ? validLaps.reduce((sum, l) => sum + l.lapTime, 0) / validLaps.length
        : 0;

    // Calculate laps possible with current fuel
    const lapsWithFuel = fuelLevel / avgFuelPerLap;

    // Determine laps remaining
    let lapsRemaining = sessionLapsRemain;
    let totalLaps = typeof sessionLaps === 'string' ? parseInt(sessionLaps, 10) : sessionLaps || 0;

    // Check for white/checkered flag first - overrides all other calculations
    // This handles final lap in both timed and lap-based races
    if (sessionFlags !== undefined && (isWhiteFlag(sessionFlags) || isCheckeredFlag(sessionFlags))) {
      // White/checkered flag = final lap or race complete
      // Set to 1 lap remaining to show fuel to finish line, ignore any time extensions

      // Only log when flag state changes to avoid spam
      const state = useFuelStore.getState();
      const flagChanged = state.lastSessionFlags !== sessionFlags;
      if (flagChanged) {
        console.log(`[FuelCalculator] ${isCheckeredFlag(sessionFlags) ? 'Checkered' : 'White'} flag detected - final lap (ignoring sessionTimeRemain: ${sessionTimeRemain}, sessionLapsRemain: ${sessionLapsRemain})`);
        // Update stored flag state
        useFuelStore.setState({ lastSessionFlags: sessionFlags });
      }

      lapsRemaining = 1;
      totalLaps = lap + 1;
    } else if (sessionLapsRemain === 32767) {
      // Timed race without white flag - estimate from time
      if (sessionTimeRemain !== undefined && sessionTimeRemain > 0) {
        const avgLapTime =
          validLaps.reduce((sum, l) => sum + l.lapTime, 0) / validLaps.length;
        lapsRemaining = Math.ceil(sessionTimeRemain / avgLapTime) + 1;
        totalLaps = lap + lapsRemaining;
      } else {
        // Can't determine laps remaining for timed race - use best estimate
        // Assume 1 lap remaining to keep calculator visible
        lapsRemaining = 1;
        totalLaps = lap + 1;
      }
    }

    // For lap-based races, account for race leader in multi-class racing
    // Find the leader (position 1) and their lap number
    if (carIdxPosition?.value && carIdxLap?.value && sessionLapsRemain !== 32767) {
      const leaderCarIdx = carIdxPosition.value.findIndex((pos) => pos === 1);
      if (leaderCarIdx !== -1) {
        const leaderLap = carIdxLap.value[leaderCarIdx];
        // Ensure totalLaps is valid before using it
        if (leaderLap !== undefined && Number.isFinite(totalLaps) && totalLaps > 0 && leaderLap > 0) {
          // Leader's laps remaining
          const leaderLapsRemaining = totalLaps - leaderLap;
          // Guard against negative or unreasonably large values
          // This can happen with data glitches or when leader position changes
          if (leaderLapsRemaining > 0 && leaderLapsRemaining < 10000) {
            // Use the minimum of your laps remaining or leader's laps remaining
            // This accounts for being lapped - race ends when leader finishes
            lapsRemaining = Math.min(lapsRemaining, leaderLapsRemaining);
          }
        }
      }
    }

    // Guard against invalid lapsRemaining
    // Don't reset to sessionLapsRemain if it's the magic timed-race value (32767)
    if (!Number.isFinite(lapsRemaining) || lapsRemaining < 0 || lapsRemaining > 10000) {
      if (sessionLapsRemain !== 32767) {
        lapsRemaining = sessionLapsRemain;
      } else {
        // If sessionLapsRemain is the timed-race magic number and we have invalid lapsRemaining,
        // we can't make a valid calculation - return null
        return null;
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
      avgLapTime,
    };

    // Only log when lap changes to avoid spam
    const state = useFuelStore.getState();
    if (result.currentLap !== state.lastLap) {
      console.log(`[FuelCalculator] Lap ${result.currentLap} - Fuel: ${result.fuelLevel.toFixed(2)}L, LapsRemaining: ${result.lapsRemaining}, AvgPerLap: ${avgFuelPerLap.toFixed(3)}L, ToFinish: ${result.fuelToFinish.toFixed(2)}L, CanFinish: ${result.canFinish}, ValidLaps: ${validLaps.length}, TotalLaps: ${totalLaps}, LeaderLap: ${carIdxLap?.value?.[carIdxPosition?.value?.findIndex(p => p === 1) ?? -1] ?? 'N/A'}`);
    }
    return result;
  }, [
    fuelLevel,
    fuelLevelPct,
    lap,
    sessionLapsRemain,
    sessionLaps,
    sessionTimeRemain,
    sessionFlags,
    safetyMargin,
    carIdxPosition?.value,
    carIdxLap?.value,
    lapHistoryMap,
  ]);

  return calculation;
}
