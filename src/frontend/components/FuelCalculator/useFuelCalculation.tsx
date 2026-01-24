/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  useSessionLaps,
  useSessionStore,
  useTelemetry,
  useTelemetryValue,
} from '@irdashies/context';
import { useStore } from 'zustand';
import { useFuelStore, selectLapHistorySize } from './FuelStore';
import type { FuelCalculation, FuelLapData } from './types';
import {
  validateLapData,
  calculateWeightedAverage,
  calculateAvgLapTime,
  findFuelMinMax,
  findFirstLapNumber,
  getFullRacingLaps,
  getGreenFlagLaps,
  detectLapCrossing,
  isGreenFlag,
  isFinalLap,
  isCheckeredFlag,
  calculateConfidence,
} from './fuelCalculations';

/** Enable debug logging (set to true for testing/troubleshooting) */
const DEBUG_LOGGING = false;

/** Magic value indicating timed race (no lap limit) */
const TIMED_RACE_LAPS_REMAINING = 32767;

/** Default fuel tank capacity when unable to calculate */
const DEFAULT_TANK_CAPACITY = 60;

/** Maximum reasonable laps remaining (sanity check) */
const MAX_REASONABLE_LAPS = 10000;

export function useFuelCalculation(
  safetyMargin = 0.05
): FuelCalculation | null {
  const fuelLevel = useTelemetryValue('FuelLevel');
  const fuelLevelPct = useTelemetryValue('FuelLevelPct');
  const lap = useTelemetryValue('Lap');
  const lapDistPct = useTelemetryValue('LapDistPct');
  const sessionLapsRemain = useTelemetryValue('SessionLapsRemain');
  const sessionTimeRemain = useTelemetryValue('SessionTimeRemain');
  const sessionTimeTotal = useTelemetryValue('SessionTimeTotal');
  const sessionFlags = useTelemetryValue('SessionFlags');
  const sessionTime = useTelemetryValue('SessionTime');
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionState = useTelemetryValue('SessionState');
  const sessionLaps = useSessionLaps(sessionNum);
  const onPitRoad = useTelemetryValue('OnPitRoad');

  // Get race leader's lap for multi-class racing
  const carIdxLap = useTelemetry('CarIdxLap');
  const carIdxPosition = useTelemetry('CarIdxPosition');

  // Get fuel tank capacity from DriverInfo
  const driverCarFuelMaxLtr = useStore(
    useSessionStore,
    (state) => state.session?.DriverInfo?.DriverCarFuelMaxLtr
  );

  // Get maximum fuel percentage allowed by session (e.g., 0.6 for 60% tank limit)
  const driverCarMaxFuelPct = useStore(
    useSessionStore,
    (state) => state.session?.DriverInfo?.DriverCarMaxFuelPct
  );

  // Calculate actual tank capacity respecting session limits
  const fuelTankCapacityFromSession =
    driverCarFuelMaxLtr !== undefined && driverCarMaxFuelPct !== undefined
      ? driverCarFuelMaxLtr * driverCarMaxFuelPct
      : driverCarFuelMaxLtr;

  // Get track ID to detect track changes
  const trackId = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackID
  );

  // Store actions (stable references)
  const updateSessionInfo = useFuelStore((state) => state.updateSessionInfo);
  const clearAllData = useFuelStore((state) => state.clearAllData);
  const addLapData = useFuelStore((state) => state.addLapData);
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const updateLapDistPct = useFuelStore((state) => state.updateLapDistPct);

  // Subscribe to lap history size to trigger recalculation when laps are added
  // More efficient than subscribing to entire Map
  const lapHistorySize = useFuelStore(selectLapHistorySize);

  // Cache leader position lookup to avoid recalculating on every telemetry tick
  const leaderLapRef = useRef<number | undefined>(undefined);

  // Update leader lap only when position data changes meaningfully
  useEffect(() => {
    if (!carIdxPosition?.value || !carIdxLap?.value) {
      leaderLapRef.current = undefined;
      return;
    }

    const positions = carIdxPosition.value;
    const laps = carIdxLap.value;

    // Find leader (position 1)
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] === 1) {
        leaderLapRef.current = laps[i];
        return;
      }
    }

    leaderLapRef.current = undefined;
  }, [carIdxPosition?.value, carIdxLap?.value]);

  // Track current session number (preserves data across session changes)
  useEffect(() => {
    if (sessionNum !== undefined) {
      updateSessionInfo(sessionNum);
    }
  }, [sessionNum, updateSessionInfo]);

  // Clear fuel data when session ends or track changes
  // Track the last known track ID to detect changes
  const lastTrackIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Clear data if session ends (SessionState.Invalid = 0)
    if (sessionState === 0) {
      if (DEBUG_LOGGING) console.log('[FuelCalculator] Session ended (SessionState=0), clearing all fuel data');
      clearAllData();
      lastTrackIdRef.current = undefined;
      return;
    }

    // Clear data if track changes (new session at different track)
    if (trackId !== undefined && lastTrackIdRef.current !== undefined && trackId !== lastTrackIdRef.current) {
      if (DEBUG_LOGGING) console.log(`[FuelCalculator] Track changed (${lastTrackIdRef.current} -> ${trackId}), clearing all fuel data`);
      clearAllData();
    }

    // Update the last known track ID
    if (trackId !== undefined) {
      lastTrackIdRef.current = trackId;
    }
  }, [sessionState, trackId, clearAllData]);

  // Update session flags state to avoid setState during render
  const lastSessionFlagsRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (sessionFlags !== undefined && lastSessionFlagsRef.current !== sessionFlags) {
      useFuelStore.setState({ lastSessionFlags: sessionFlags });
      lastSessionFlagsRef.current = sessionFlags;
    }
  }, [sessionFlags]);

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
      const completedLap = lap - 1;
      const fuelUsed = state.lapStartFuel - fuelLevel;
      const lapTime = sessionTime - state.lapCrossingTime;

      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Lap ${completedLap} complete - Used: ${fuelUsed.toFixed(3)}L, Time: ${lapTime.toFixed(2)}s, Remaining: ${fuelLevel.toFixed(2)}L, SessionLapsRemain: ${sessionLapsRemain}`
        );
      }

      // Skip lap 0 (standing/rolling start laps are typically incomplete)
      // Validate and store lap data only from lap 1 onwards
      if (completedLap >= 1 && fuelUsed > 0 && lapTime > 0) {
        const recentLaps = state.getRecentLaps(10);
        const isValid = validateLapData(fuelUsed, lapTime, recentLaps);

        const lapData: FuelLapData = {
          lapNumber: completedLap,
          fuelUsed,
          lapTime,
          isGreenFlag: isGreenFlag(sessionFlags),
          isValidForCalc: isValid,
          isOutLap: state.wasOnPitRoad, // Mark if lap started from pit road
          timestamp: Date.now(),
        };

        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator]   -> Valid: ${lapData.isValidForCalc}, Green: ${lapData.isGreenFlag}, OutLap: ${lapData.isOutLap}`
          );
        }

        addLapData(lapData);
      }

      // Now update lap crossing state for the NEW lap
      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap,
        onPitRoad === 1
      );
    } else if (state.lastLapDistPct === 0) {
      // Initialize on first telemetry
      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap,
        onPitRoad === 1
      );
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

    // Get lap history from store
    const lapHistory = useFuelStore.getState().getLapHistory();

    // Need at least 1 lap for calculations
    if (lapHistory.length < 1) {
      return null;
    }

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return null;

    // Get tank capacity - prioritize session data as it now includes tank limit multiplier
    // Falls back to calculation from fuel level if session data unavailable
    const fuelTankCapacity =
      fuelTankCapacityFromSession ??
      (fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : DEFAULT_TANK_CAPACITY);

    // Find first lap number once and reuse
    const firstLapNumber = findFirstLapNumber(validLaps);

    // Exclude out-laps and first lap (from grid or after reset) for calculations
    // as they're typically not full racing laps with representative fuel consumption
    const fullLaps = getFullRacingLaps(validLaps, firstLapNumber);

    // If no full racing laps yet (early in session), use all valid laps as fallback
    const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;

    // Get different lap groupings from laps to use
    const greenLaps = getGreenFlagLaps(lapsToUse);
    const last3 = lapsToUse.slice(0, 3);
    const last10 = lapsToUse.slice(0, 10);

    // Calculate averages
    const lastLapUsage = lapsToUse[0]?.fuelUsed || 0;
    const avg3Laps =
      last3.length > 0 ? calculateWeightedAverage(last3) : lastLapUsage;
    const avg10Laps =
      last10.length > 0 ? calculateWeightedAverage(last10) : avg3Laps;
    const avgAllGreenLaps =
      greenLaps.length > 0 ? calculateWeightedAverage(greenLaps) : avg10Laps;

    // Calculate min and max fuel consumption
    const { min: minLapUsage, max: maxLapUsage } = findFuelMinMax(lapsToUse);

    // Use 10-lap average as primary metric, fall back to 3-lap if needed
    const avgFuelPerLap = last10.length >= 5 ? avg10Laps : avg3Laps;

    // Guard against zero or invalid avgFuelPerLap
    if (avgFuelPerLap <= 0) {
      return null;
    }

    // Calculate average lap time
    const avgLapTime = calculateAvgLapTime(lapsToUse);

    // Calculate laps possible with current fuel
    const lapsWithFuel = fuelLevel / avgFuelPerLap;

    // Determine laps remaining
    let lapsRemaining = sessionLapsRemain;
    let totalLaps =
      typeof sessionLaps === 'string'
        ? parseInt(sessionLaps, 10)
        : sessionLaps || 0;

    // Check for white/checkered flag first - overrides all other calculations
    // This handles final lap in both timed and lap-based races
    if (sessionFlags !== undefined && isFinalLap(sessionFlags)) {
      // White/checkered flag = final lap or race complete
      // Set to 1 lap remaining to show fuel to finish line, ignore any time extensions

      // Only log when flag state changes to avoid spam
      const flagChanged = lastSessionFlagsRef.current !== sessionFlags;
      if (flagChanged) {
        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator] ${isCheckeredFlag(sessionFlags) ? 'Checkered' : 'White'} flag detected - final lap (ignoring sessionTimeRemain: ${sessionTimeRemain}, sessionLapsRemain: ${sessionLapsRemain})`
          );
        }
      }

      lapsRemaining = 1;
      totalLaps = lap + 1;
    } else if (sessionLapsRemain === TIMED_RACE_LAPS_REMAINING) {
      // Timed race without white flag - estimate from time
      if (sessionTimeRemain !== undefined && sessionTimeRemain > 0) {
        const estLapTime =
          validLaps.reduce((sum, l) => sum + l.lapTime, 0) / validLaps.length;
        lapsRemaining = Math.ceil(sessionTimeRemain / estLapTime) + 1;
        totalLaps = lap + lapsRemaining;
      } else {
        // Can't determine laps remaining for timed race - use best estimate
        // Assume 1 lap remaining to keep calculator visible
        lapsRemaining = 1;
        totalLaps = lap + 1;
      }
    }

    // For lap-based races, account for race leader in multi-class racing
    // Use cached leader lap from ref to avoid expensive array search
    const leaderLap = leaderLapRef.current;
    if (
      leaderLap !== undefined &&
      sessionLapsRemain !== TIMED_RACE_LAPS_REMAINING &&
      Number.isFinite(totalLaps) &&
      totalLaps > 0 &&
      leaderLap > 0
    ) {
      // Leader's laps remaining
      const leaderLapsRemaining = totalLaps - leaderLap;
      // Guard against negative or unreasonably large values
      // This can happen with data glitches or when leader position changes
      if (leaderLapsRemaining > 0 && leaderLapsRemaining < MAX_REASONABLE_LAPS) {
        // Use the minimum of your laps remaining or leader's laps remaining
        // This accounts for being lapped - race ends when leader finishes
        lapsRemaining = Math.min(lapsRemaining, leaderLapsRemaining);
      }
    }

    // Guard against invalid lapsRemaining
    // Don't reset to sessionLapsRemain if it's the magic timed-race value
    if (
      !Number.isFinite(lapsRemaining) ||
      lapsRemaining < 0 ||
      lapsRemaining > MAX_REASONABLE_LAPS
    ) {
      if (sessionLapsRemain !== TIMED_RACE_LAPS_REMAINING) {
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

    // Calculate pit window
    const pitWindowOpen = lap + 1;
    const pitWindowClose = lap + lapsWithFuel - 1;

    // Target consumption for fuel saving
    const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

    // Calculate fuel at finish (current fuel - fuel needed for remaining laps)
    const fuelAtFinish = fuelLevel - lapsRemaining * avgFuelPerLap;

    // Calculate confidence
    const confidence = calculateConfidence(validLaps.length);

    // ========================================================================
    // Calculate Stops Remaining (pit stops needed from current position)
    // ========================================================================
    let stopsRemaining: number | undefined;
    let lapsPerStint: number | undefined;

    // Calculate laps per stint based on FULL TANK (how many laps on a full tank)
    if (fuelTankCapacity > 0 && avgFuelPerLap > 0) {
      lapsPerStint = fuelTankCapacity / avgFuelPerLap;
    }

    // Calculate stops remaining to finish the race
    // Uses lapsRemaining which is already calculated for both timed and lap-based races
    if (
      lapsRemaining > 0 &&
      fuelTankCapacity > 0 &&
      avgFuelPerLap > 0 &&
      fuelLevel >= 0
    ) {
      // Fuel needed to finish with safety margin (same as fuelNeeded calculated above)
      // We reuse fuelNeeded here since it already includes the safety margin
      const fuelNeededToFinish = fuelNeeded;

      if (fuelLevel >= fuelNeededToFinish) {
        // Current fuel is sufficient to finish - no stops needed
        stopsRemaining = 0;
      } else {
        // Calculate how much more fuel we need beyond current tank
        const fuelDeficit = fuelNeededToFinish - fuelLevel;

        // Each pit stop fills tank to capacity, adding tankCapacity to our budget
        // Formula: currentFuel + (numStops × tankCapacity) >= fuelNeeded
        // Solving: numStops >= (fuelNeeded - currentFuel) / tankCapacity
        stopsRemaining = Math.ceil(fuelDeficit / fuelTankCapacity);
      }
    }

    // ========================================================================
    // Calculate Fuel To Add (smart calculation based on stops remaining)
    // ========================================================================
    let fuelToAdd = 0;

    if (stopsRemaining !== undefined && stopsRemaining > 1) {
      // Multiple stops remaining: fill to full tank capacity
      fuelToAdd = Math.max(0, fuelTankCapacity - fuelLevel);
    } else if (stopsRemaining === 1 || stopsRemaining === 0) {
      // Last stop or no stops needed: add exact amount needed to finish
      // Calculate laps remaining AFTER the next pit stop
      // For last stop: this is all remaining laps
      // For no stops: this calculates fuel deficit (if any)
      const exactFuelNeeded = fuelNeeded; // Already includes safety margin
      fuelToAdd = Math.max(
        0,
        Math.min(fuelTankCapacity, exactFuelNeeded) - fuelLevel
      );
    } else {
      // stopsRemaining is undefined (no calculation available yet)
      // Fall back to basic calculation: add what's needed, capped at tank capacity
      fuelToAdd = Math.max(
        0,
        Math.min(fuelTankCapacity, fuelNeeded) - fuelLevel
      );
    }

    // ========================================================================
    // Calculate Target Consumption Scenarios
    // ========================================================================
    const targetScenarios: FuelCalculation['targetScenarios'] = [];

    // Only show scenarios if we have meaningful fuel data
    if (lapsWithFuel >= 0.5) {
      const currentLapTarget = Math.round(lapsWithFuel);

      // Determine which scenarios to show based on lapsWithFuel
      const scenarios: number[] = [];

      if (currentLapTarget > 1) {
        scenarios.push(currentLapTarget - 1); // -1 lap
      }
      scenarios.push(currentLapTarget);        // current
      scenarios.push(currentLapTarget + 1);    // +1 lap

      // Calculate fuel per lap for each scenario
      for (const lapCount of scenarios) {
        if (lapCount > 0) {
          targetScenarios.push({
            laps: lapCount,
            fuelPerLap: fuelLevel / lapCount,
            isCurrentTarget: lapCount === currentLapTarget,
          });
        }
      }
    }

    // ========================================================================
    // Calculate Earliest Pit Lap (for safety car strategy)
    // ========================================================================
    let earliestPitLap: number | undefined;

    if (stopsRemaining !== undefined && stopsRemaining > 0 && lapsPerStint !== undefined && lapsPerStint > 0) {
      // Maximum laps coverable with all remaining stops (each fills full tank)
      const maxLapsWithAllStops = lapsPerStint * stopsRemaining;

      // Excess capacity = how much more we can cover than needed
      const excessCapacity = maxLapsWithAllStops - lapsRemaining;

      if (excessCapacity >= 0) {
        // Can pit immediately on next lap
        earliestPitLap = lap + 1;
      } else {
        // Must drive some laps first before we can pit
        // Each lap we delay reduces how many laps we need to cover after pitting
        const minLapsBeforePit = Math.ceil(-excessCapacity);
        earliestPitLap = lap + Math.max(1, minLapsBeforePit);
      }

      // Ensure earliest pit doesn't exceed pit window close
      if (earliestPitLap > pitWindowClose) {
        earliestPitLap = Math.floor(pitWindowClose);
      }
    }

    const result: FuelCalculation = {
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
      sessionTimeTotal,
      stopsRemaining,
      lapsPerStint,
      targetScenarios,
      earliestPitLap,
      fuelTankCapacity,
    };

    // Only log when lap changes to avoid spam
    const state = useFuelStore.getState();
    if (result.currentLap !== state.lastLap) {
      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Lap ${result.currentLap} - Fuel: ${result.fuelLevel.toFixed(2)}L, LapsRemaining: ${result.lapsRemaining}, AvgPerLap: ${avgFuelPerLap.toFixed(3)}L, ToFinish: ${result.fuelToFinish.toFixed(2)}L, CanFinish: ${result.canFinish}, ValidLaps: ${validLaps.length}, TotalLaps: ${totalLaps}, LeaderLap: ${leaderLapRef.current ?? 'N/A'}`
        );

        // Log endurance strategy details
        if (result.stopsRemaining !== undefined) {
          console.log(
            `[Endurance] LapsRemaining: ${result.lapsRemaining}, Fuel/lap: ${avgFuelPerLap.toFixed(2)}L, ` +
            `Needed: ${result.fuelToFinish.toFixed(1)}L (inc ${(safetyMargin * 100).toFixed(0)}% margin), ` +
            `Current: ${result.fuelLevel.toFixed(1)}L, Tank: ${fuelTankCapacity.toFixed(1)}L, ` +
            `Stops: ${result.stopsRemaining}, Laps/stint: ${result.lapsPerStint?.toFixed(1) ?? 'N/A'}`
          );
        }
      }
    }
    return result;
    // lapHistorySize is intentionally included to trigger recalculation when laps are added
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fuelLevel,
    fuelLevelPct,
    lap,
    sessionLapsRemain,
    sessionLaps,
    sessionTimeRemain,
    sessionTimeTotal,
    sessionFlags,
    safetyMargin,
    // Use lapHistorySize instead of the full Map for efficient change detection
    lapHistorySize,
  ]);

  return calculation;
}
