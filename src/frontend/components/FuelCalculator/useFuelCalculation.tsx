/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  useSessionLaps,
  useSessionStore,
  useTelemetryValue,
} from '@irdashies/context';
import { useStore } from 'zustand';
import { useFuelStore, selectLapHistorySize } from './FuelStore';
import { FuelLapData } from '@irdashies/types';
import type {
  FuelCalculation,
  FuelCalculatorSettings,
} from './types';
import {
  validateLapData,
  calculateSimpleAverage,
  calculateAvgLapTime,
  findFuelMinMax,
  getGreenFlagLaps,
  detectLapCrossing,
  isGreenFlag,
  isFinalLap,
  isCheckeredFlag,
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
  safetyMargin = 0.3,
  settings?: FuelCalculatorSettings
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
  const setContextInfo = useFuelStore((state) => state.setContextInfo);
  const storedTrackId = useFuelStore((state) => state.trackId);
  const storedCarName = useFuelStore((state) => state.carName);

  // Persistent qualify store
  const qualifyConsumption = useFuelStore((state) => state.qualifyConsumption);
  const setQualifyConsumption = useFuelStore(
    (state) => state.setQualifyConsumption
  );

  // Subscribe to lapStartFuel to calculate live usage
  const lapStartFuel = useFuelStore((state) => state.lapStartFuel);

  // Subscribe to lap history size to trigger recalculation when laps are added
  // More efficient than subscribing to entire Map
  const lapHistorySize = useFuelStore(selectLapHistorySize);

  // Refs for smoothing projected lap usage
  const smoothedProjectedUsageRef = useRef<number>(0);
  const lastSmoothedLapRef = useRef<number>(-1);



  // Track current session number (preserves data across session changes)
  useEffect(() => {
    if (sessionNum !== undefined) {
      updateSessionInfo(sessionNum);
    }
  }, [sessionNum, updateSessionInfo]);

  // Clear fuel data when session ends or track changes
  // Track the last known track ID to detect changes

  useEffect(() => {
    // We NO LONGER clear data on sessionState === 0.
    // This allows data to persist across session transitions (Practice -> Qualify -> Race).

    const currentCarName = (
      useSessionStore.getState().session?.DriverInfo as {
        DriverCarName?: string;
      }
    )?.DriverCarName;

    // Check for Track Change (or initial load)
    const trackChanged =
      trackId !== undefined &&
      (storedTrackId === undefined || trackId !== storedTrackId);

    // Check for Car Change (drivers can switch cars in some sessions/replays)
    const carChanged =
      currentCarName !== undefined &&
      (storedCarName === undefined || currentCarName !== storedCarName);

    if (trackChanged || carChanged) {
      if (DEBUG_LOGGING)
        console.log(
          `[FuelCalculator] Context changed (Track: ${storedTrackId}->${trackId}, Car: ${storedCarName}->${currentCarName}), loading fuel data`
        );
      if (storedTrackId !== undefined && storedCarName !== undefined) {
          clearAllData();
      }
      setQualifyConsumption(null); // Explicitly clear/reset qualify consumption on track/car change so we don't use invalid data

      // Load historical data from JSON storage
      if (trackId !== undefined && currentCarName !== undefined && (settings?.enableStorage ?? true)) {
        // Load lap history
        window.fuelCalculatorBridge
          .getHistoricalLaps(trackId, currentCarName)
          .then((laps) => {
            if (laps.length > 0) {
              if (DEBUG_LOGGING)
                console.log(
                  `[FuelCalculator] Loaded ${laps.length} historical laps from DB`
                );
              useFuelStore.getState().setLapHistory(laps);
            }
          });

        // Load qualify max
        window.fuelCalculatorBridge
          .getQualifyMax(trackId, currentCarName)
          .then((val) => {
            if (val !== null) {
              if (DEBUG_LOGGING)
                console.log(`[FuelCalculator] Loaded QualifyMax (${val}) from DB`);
              setQualifyConsumption(val);
            }
          });
      }
    }

    // Always update context info to be current
    if (trackId !== undefined || currentCarName !== undefined) {
      // Only update if changed to avoid loop
      if (trackId !== storedTrackId || currentCarName !== storedCarName) {
        setContextInfo(trackId, currentCarName);
      }
    }
  }, [
    sessionState,
    trackId,
    storedTrackId,
    storedCarName,
    clearAllData,
    setContextInfo,
    setQualifyConsumption,
    settings?.enableStorage,
  ]);

  // Update session flags state to avoid setState during render
  const lastSessionFlagsRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      sessionFlags !== undefined &&
      lastSessionFlagsRef.current !== sessionFlags
    ) {
      useFuelStore.setState({ lastSessionFlags: sessionFlags });
      lastSessionFlagsRef.current = sessionFlags;
    }
  }, [sessionFlags]);

  const playerCarTowTime = useTelemetryValue('PlayerCarTowTime');
  const wasTowedDuringLapRef = useRef(false);

  // Monitor tow time to detect incidents
  const wasOnPitRoadDuringLapRef = useRef(false);

  useEffect(() => {
    if (playerCarTowTime !== undefined && playerCarTowTime > 0) {
      wasTowedDuringLapRef.current = true;
    }
  }, [playerCarTowTime]);

  // Monitor Pit Road status usage to detect In-Laps
  useEffect(() => {
     if (onPitRoad) {
         wasOnPitRoadDuringLapRef.current = true;
     }
  }, [onPitRoad]);

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
    // OR when the lap counter increments (to handle telemetry lag where distance might jump)
    // Use state.lastLapDistPct which tracks the distance from the previous update
    const distCrossing = detectLapCrossing(lapDistPct, state.lastLapDistPct);
    const lapIncremented = lap > state.lastLap;

    // Only treat lap increment as crossing if it's a 1-lap increment (avoid resets/towing jumps for now, or handle separately)
    // Actually, if we tow, we usually want to reset or invalidate.
    // For now, robustly accept 1-lap forward.
    const isCrossing =
      distCrossing || (lapIncremented && lap - state.lastLap === 1);

    if (isCrossing) {
      // Robustly determine completed lap number
      // If we detected via integer increment, then 'lap' is the NEW lap.
      // If via distance, 'lap' might still be OLD lap or NEW lap depending on telemetry phase.
      // But usually 'lap' updates at crossing.

      // If lapIncremented is true, we definitely finished 'state.lastLap'.
      // If distCrossing is true, we finished 'state.lastLap'.
      const completedLap = state.lastLap;

      const fuelUsed = state.lapStartFuel - fuelLevel;
      const lapTime = sessionTime - state.lapCrossingTime;

      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Lap ${completedLap} complete - Used: ${fuelUsed.toFixed(3)}L, Time: ${lapTime.toFixed(2)}s, Remaining: ${fuelLevel.toFixed(2)}L, SessionLapsRemain: ${sessionLapsRemain}`
        );
      }

      // Record lap data
      // Only record Lap 1 onwards (exclude Lap 0/Start laps)
      if (completedLap >= 1 && fuelUsed > 0 && lapTime > 0) {
        // Validation logic...
        const recentLaps = state.getRecentLaps(10);
        // A lap is invalid if a tow occurred OR if it fails statistical outlier detection
        const isOutlier = !validateLapData(fuelUsed, lapTime, recentLaps);
        const wasTowed = wasTowedDuringLapRef.current;
        const isValid = !wasTowed && !isOutlier;

        const lapData: FuelLapData = {
          lapNumber: completedLap,
          fuelUsed,
          lapTime,
          isGreenFlag: isGreenFlag(sessionFlags),
          isValidForCalc: isValid,
          isOutLap: state.wasOnPitRoad, // Mark if lap started from pit road (Out Lap)
          isInLap: wasOnPitRoadDuringLapRef.current, // Mark if lap involved pit road (In Lap)
          wasTowed,
          timestamp: Date.now(),
          sessionNum,
        };

        if (DEBUG_LOGGING || wasTowed) {
          console.log(
            `[FuelCalculator]   -> Valid: ${lapData.isValidForCalc}, Green: ${lapData.isGreenFlag}, OutLap: ${lapData.isOutLap}, InLap: ${lapData.isInLap}, Towed: ${wasTowed}, Outlier: ${isOutlier}`
          );
        }

        addLapData(lapData);

        // Save to JSON storage for persistence
        if (storedTrackId !== undefined && storedCarName !== undefined && (settings?.enableStorage ?? true)) {
          window.fuelCalculatorBridge.saveLap(
            storedTrackId,
            storedCarName,
            lapData
          );
        }
      }

      // Reset flags for the new lap
      wasTowedDuringLapRef.current = false;
      // If we are currently on pit road (pit stop), the NEXT lap will start on pit road.
      // But the 'wasOnPitRoadDuringLapRef' tracks if we touched it DURING the completed lap.
      // We reset it to false, but if we are *currently* on pit road, it will be set to true immediately by the effect?
      // Actually, if we are stationary in pits, onPitRoad is high.
      // The effect `useEffect(() => { if (onPitRoad) ... })` will trigger on next render.
      // So resetting to false is correct for the start of the NEW lap.
      wasOnPitRoadDuringLapRef.current = false;

      // Now update lap crossing state for the NEW lap
      // Ensure we increment to the next lap correctly
      // taking the max of 'lap' (telemetry) and 'completedLap + 1' ensures we sync
      const nextLap = Math.max(lap, completedLap + 1);

      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        nextLap,
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
    playerCarTowTime,
    addLapData,
    updateLapCrossing,
    updateLapDistPct,
  ]);

  // Track Max Qualifying Consumption
  useEffect(() => {
    // Only process if we are in a qualifying session
    const currentSessionType = useSessionStore
      .getState()
      .session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.SessionType;

    const isQualifying =
      currentSessionType && currentSessionType.includes('Qualify');

    if (isQualifying) {
      const lapHistory = useFuelStore.getState().getLapHistory();

      // Relaxed validation: !wasTowed only.
      // logic mirrors the main calculation 'lapsToUse' fallback:
      // Prefer Non-OutLaps, but if ONLY OutLaps exist (early session), use them.
      const allCandidates = lapHistory.filter((l) => !l.wasTowed);
      const fullLaps = allCandidates.filter((l) => !l.isOutLap);

      const lapsToUse = fullLaps.length > 0 ? fullLaps : allCandidates;

      // Logic: Favor current session laps for Qualify MAX. Fallback to historical if session is empty.
      // Filter by sessionNum to ensure we only use laps from THIS specific qualifying session
      const sessionLaps = allCandidates.filter((l) => !l.isHistorical && l.sessionNum === sessionNum);
      const qualifyLapsToUse = sessionLaps.length > 0
        ? (sessionLaps.filter(l => !l.isOutLap).length > 0 ? sessionLaps.filter(l => !l.isOutLap) : sessionLaps)
        : lapsToUse;

      if (qualifyLapsToUse.length > 0) {
        // Find max consumption
        const maxFuelUsed = Math.max(...qualifyLapsToUse.map((l) => l.fuelUsed));

        // Update persistent store if new max is found or not set
        // Logic: "overwrite what was saved before" if we have valid data in the current session
        if (qualifyConsumption === null || maxFuelUsed !== qualifyConsumption) {
          if (DEBUG_LOGGING)
            console.log(
              `[FuelCalculator] Updating Qualify Max: ${qualifyConsumption} -> ${maxFuelUsed}`
            );
          setQualifyConsumption(maxFuelUsed);

          // Save to JSON storage
          if (storedTrackId !== undefined && storedCarName !== undefined && (settings?.enableStorage ?? true)) {
            window.fuelCalculatorBridge.saveQualifyMax(storedTrackId, storedCarName, maxFuelUsed);
          }
        }
      }
    }
  }, [
    sessionNum,
    lapHistorySize,
    qualifyConsumption,
    setQualifyConsumption,
    storedTrackId,
    storedCarName,
    settings?.enableStorage,
  ]); // Trigger on lap add or session change

  // Calculate fuel metrics
  const calculation = useMemo((): FuelCalculation | null => {
    // Default fallback object to prevent UI flickering/unmounting
    const emptyCalculation: FuelCalculation = {
      fuelLevel: fuelLevel ?? 0,
      lastLapUsage: 0,
      currentLapUsage:
        lapStartFuel > 0 && fuelLevel
          ? Math.max(0, lapStartFuel - fuelLevel)
          : 0,
      avgLaps: 0,
      avg10Laps: 0,
      avgAllGreenLaps: 0,
      minLapUsage: 0,
      maxLapUsage: 0,
      lapsWithFuel: 0,
      lapsRemaining: sessionLapsRemain ?? 0,
      totalLaps:
        typeof sessionLaps === 'string'
          ? parseInt(sessionLaps, 10)
          : sessionLaps || 0,
      currentLap: lap ?? 0,
      fuelToFinish: 0,
      fuelToAdd: 0,
      pitWindowOpen: 0,
      pitWindowClose: 0,
      canFinish: false,
      targetConsumption: 0,
      confidence: 'low',
      fuelAtFinish: 0,
      avgLapTime: 0,
      sessionTimeTotal: sessionTimeTotal ?? 0,
      stopsRemaining: 0,
      lapsPerStint: 0,
      targetScenarios: [],
      earliestPitLap: undefined,
      fuelTankCapacity: 60, // Default fallback
      fuelStatus: 'safe',
      maxQualify: qualifyConsumption, // Use stored value even if calculation is empty
    };

    if (
      fuelLevel === undefined ||
      fuelLevelPct === undefined ||
      lap === undefined ||
      sessionLapsRemain === undefined ||
      sessionLaps === undefined
    ) {
      return emptyCalculation;
    }

    // Get lap history from store
    const lapHistory = useFuelStore.getState().getLapHistory();

    // Need at least 1 lap for calculations
    if (lapHistory.length < 1) {
      // Even if no history, we might want to return current usage if valid
      // Return the fallback with live usage populated
      return emptyCalculation;
    }

    // Use lapStartFuel for current lap usage
    // Default to 0 if negative (refuel) or unset
    const currentLapUsage =
      lapStartFuel > 0 ? Math.max(0, lapStartFuel - fuelLevel) : 0;

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return { ...emptyCalculation, currentLapUsage };

    // ... rest of calculation logic ...

    // Get tank capacity - prioritize session data as it now includes tank limit multiplier
    // Falls back to calculation from fuel level if session data unavailable
    const fuelTankCapacity =
      fuelTankCapacityFromSession ??
      (fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : DEFAULT_TANK_CAPACITY);

    // Exclude out-laps AND in-laps (pit stop laps).
    // We filter out any lap where the car was on pit road (in or out) to ensure clean racing laps for average.
    const fullLaps = validLaps.filter((l) => !l.isOutLap && !l.isInLap);

    // If no full racing laps yet (early in session), use all valid laps as fallback
    // User requested strict exclusion of Out Laps.
    // const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;
    const lapsToUse = fullLaps;

    // Get different lap groupings from laps to use
    const greenLaps = getGreenFlagLaps(lapsToUse);
    const avgLapsCount = settings?.avgLapsCount || 3;
    const lastLapsForAvg = lapsToUse.slice(0, avgLapsCount);
    const last10 = lapsToUse.slice(0, 10);

    // Calculate averages - Use Simple Average for display metrics (matches user expectations)
    const lastLapUsage = lapsToUse[0]?.fuelUsed || 0;
    const avgLaps =
      lastLapsForAvg.length > 0
        ? calculateSimpleAverage(lastLapsForAvg)
        : lastLapUsage;
    const avg10Laps =
      last10.length > 0 ? calculateSimpleAverage(last10) : avgLaps;
    const avgAllGreenLaps =
      greenLaps.length > 0 ? calculateSimpleAverage(greenLaps) : avg10Laps;

    // Calculate min and max fuel consumption
    // Fix: Prioritize current session laps for MAX. Fallback to historical only if session is empty.
    const currentSessionLaps = lapsToUse.filter((l) => !l.isHistorical);
    const maxSourceLaps = currentSessionLaps.length > 0 ? currentSessionLaps : lapsToUse;
    const { min: minLapUsage, max: maxLapUsage } = findFuelMinMax(maxSourceLaps);



    // Use customizable average as primary metric, but include projected current lap
    // This allows refuel to update LIVE during the lap (like Kapps)
    let avgFuelPerLapBase = avgLaps; // Base average without current lap projection
    let avgFuelPerLapForConsumption = avgLaps; // For consumption display (refuel, at finish, laps)

    // FALLBACK: If no valid laps yet (race start), use qualify or historical data
    if (avgFuelPerLapBase <= 0) {
      // Try qualify consumption first
      if (qualifyConsumption && qualifyConsumption > 0) {
        avgFuelPerLapBase = qualifyConsumption;
        avgFuelPerLapForConsumption = qualifyConsumption;
      }
      // Then try historical average
      else if (lapsToUse.length > 0 && lapsToUse[0].isHistorical) {
        const historicalAvg = calculateSimpleAverage(lapsToUse.slice(0, 5));
        if (historicalAvg > 0) {
          avgFuelPerLapBase = historicalAvg;
          avgFuelPerLapForConsumption = historicalAvg;
        }
      }
    }

    // Guard against zero or invalid avgFuelPerLap - only return null if we truly have no data
    if (avgFuelPerLapBase <= 0) {
      return null;
    }

    // Calculate average lap time
    const avgLapTime = calculateAvgLapTime(lapsToUse);

    // Calculate laps possible with current fuel - uses BASE average (stable) to prevent gauge fluctuation
    const lapsWithFuel = avgFuelPerLapBase > 0 ? fuelLevel / avgFuelPerLapBase : 0;

    // Determine laps remaining - SIMPLIFIED
    let lapsRemaining = sessionLapsRemain || 0;
    let totalLaps =
      typeof sessionLaps === 'string'
        ? parseInt(sessionLaps, 10)
        : sessionLaps || 0;

    // Check for white/checkered flag first - overrides all other calculations
    if (sessionFlags !== undefined && isFinalLap(sessionFlags)) {
      // Final lap: use remaining distance for precision
      const remainingDistance = Math.max(0, 1 - (lapDistPct || 0));
      lapsRemaining = remainingDistance;
      totalLaps = lap + 1;

      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] ${isCheckeredFlag(sessionFlags) ? 'Checkered' : 'White'} flag - final lap, remaining: ${lapsRemaining.toFixed(2)}`
        );
      }
    } 
    // Timed race: estimate from YOUR pace (simple and reliable)
    else if (sessionLapsRemain === TIMED_RACE_LAPS_REMAINING) {
      if (sessionTimeRemain !== undefined && sessionTimeRemain > 0 && avgLapTime > 0) {
        lapsRemaining = Math.ceil(sessionTimeRemain / avgLapTime);
        totalLaps = lap + lapsRemaining;

        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator] Timed race: ${sessionTimeRemain.toFixed(0)}s remaining, ` +
            `avg lap: ${avgLapTime.toFixed(1)}s, estimated laps: ${lapsRemaining}`
          );
        }
      } else {
        // Fallback: assume 1 lap remaining
        lapsRemaining = 1;
        totalLaps = lap + 1;
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
    // Safety margin is now a fixed amount (L or gal)
    // If unit is gallons, convert to liters for internal calculation (1 gal = 3.78541 L)
    const marginAmount =
      settings?.fuelUnits === 'gal' ? safetyMargin * 3.78541 : safetyMargin;

    const fuelNeeded = lapsRemaining * avgFuelPerLapForConsumption + marginAmount;
    const canFinish = fuelLevel >= fuelNeeded;

    // Calculate pit window
    const pitWindowOpen = lap + 1;
    const pitWindowClose = lap + lapsWithFuel - 1;

    // Target consumption for fuel saving
    const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

    // Calculate fuel at finish (current fuel - fuel needed for remaining laps)
    const fuelAtFinish = fuelLevel - lapsRemaining * avgFuelPerLapForConsumption;

    // ========================================================================
    // Calculate Confidence and Lap Range (Simplified)
    // ========================================================================
    let confidence: 'low' | 'medium' | 'high' = 'low';
    let lapsRange: [number, number] = [0, 0];

    // Simple confidence based on lap count
    if (validLaps.length >= 5) {
      confidence = 'high';
    } else if (validLaps.length >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Simple ±1 lap range
    lapsRange = [
      Math.max(0, Math.floor(lapsRemaining)),
      Math.ceil(lapsRemaining) + 1
    ];

    // Always fuel for the worst case (top of the range)

    // ========================================================================
    // Calculate Fuel Status (Custom logic for Gauge/Borders)
    // ========================================================================
    const statusThresholds = settings?.fuelStatusThresholds || {
      green: 60,
      amber: 30,
      red: 10,
    };
    const statusBasis = settings?.fuelStatusBasis || 'avg';
    const redLapsThreshold = settings?.fuelStatusRedLaps ?? 3;

    let fuelStatus: 'safe' | 'caution' | 'danger' = 'safe';

    // Percentage based thresholds
    const currentFuelPctValue = (fuelLevelPct ?? 0) * 100;
    const sessionType = useSessionStore
      .getState()
      .session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.SessionType;

    const isQualifyingOrPractice =
      sessionType &&
      ['Lone Qualify', 'Open Qualify', 'Practice', 'Offline Testing'].includes(
        sessionType
      );

    // Dynamic thresholds based on session type
    const effectiveStatusThresholds = isQualifyingOrPractice
      ? { green: 20, amber: 10, red: 5 } // Much lower for qualifying/practice
      : statusThresholds;

    if (currentFuelPctValue >= effectiveStatusThresholds.green) {
      fuelStatus = 'safe';
    } else if (currentFuelPctValue >= effectiveStatusThresholds.amber) {
      fuelStatus = 'caution';
    } else {
      fuelStatus = 'danger';
    }

    // Laps remaining override logic (quantity remaining check)
    // Select consumption based on user setting
    const basisUsageValue =
      statusBasis === 'max'
        ? maxLapUsage
        : statusBasis === 'min'
          ? minLapUsage
          : statusBasis === 'last'
            ? lastLapUsage
            : avgFuelPerLapBase;

    const lapsLeftOnBasis =
      basisUsageValue > 0 ? fuelLevel / basisUsageValue : 0;

    // Determine effective red laps threshold
    const effectiveRedLaps = isQualifyingOrPractice
      ? Math.min(redLapsThreshold, 1) // Force 1 lap threshold for qualifying if not already lower
      : redLapsThreshold;

    // If laps remaining is below threshold, force "danger" (Red)
    if (lapsLeftOnBasis < effectiveRedLaps && lapsLeftOnBasis > 0) {
      fuelStatus = 'danger';
    } else if (
      isQualifyingOrPractice &&
      lapsLeftOnBasis < 2 &&
      fuelStatus === 'safe'
    ) {
      // For qualifying, show caution if under 2 laps remaining even if pct is okay
      fuelStatus = 'caution';
    }

    // ========================================================================
    // Calculate Stops Remaining (pit stops needed from current position)
    // ========================================================================
    let stopsRemaining: number | undefined;
    let lapsPerStint: number | undefined;

    // Calculate laps per stint based on FULL TANK (how many laps on a full tank)
    if (fuelTankCapacity > 0 && avgFuelPerLapBase > 0) {
      lapsPerStint = fuelTankCapacity / avgFuelPerLapBase;
    }

    // Calculate stops remaining to finish the race
    // Uses lapsRemaining which is already calculated for both timed and lap-based races
    if (
      lapsRemaining > 0 &&
      fuelTankCapacity > 0 &&
      avgFuelPerLapBase > 0 &&
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
      const currentLapTarget = Math.floor(lapsWithFuel);

      // Determine which scenarios to show based on lapsWithFuel
      const scenarios: number[] = [];

      if (currentLapTarget > 1) {
        scenarios.push(currentLapTarget - 1); // -1 lap
      }
      scenarios.push(currentLapTarget); // current
      scenarios.push(currentLapTarget + 1); // +1 lap

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

    if (
      stopsRemaining !== undefined &&
      stopsRemaining > 0 &&
      lapsPerStint !== undefined &&
      lapsPerStint > 0
    ) {
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

    // Calculate Projected Lap Usage with Smoothing

    // Reset smoothing on new lap
    if (lastSmoothedLapRef.current !== lap) {
      smoothedProjectedUsageRef.current = 0;
      lastSmoothedLapRef.current = lap || 0;
    }

    let projectedLapUsage = 0;

    // Calculate instantaneous projection
    let instantaneousProjection = 0;
    if (
      typeof lapDistPct === 'number' &&
      lapDistPct > 0.05 &&
      currentLapUsage > 0
    ) {
      instantaneousProjection = currentLapUsage / lapDistPct;
    } else {
      instantaneousProjection = lastLapUsage || avg10Laps || 0;
    }

    // Apply smoothing (EMA)
    // Factor 0.05 = very smooth/slow. 0.1 = faster.
    // User requested "update a little slower", so 0.05 is a good start.
    const projectedSmoothingFactor = 0.05;

    if (smoothedProjectedUsageRef.current === 0) {
      // First value or reset
      smoothedProjectedUsageRef.current = instantaneousProjection;
    } else {
      smoothedProjectedUsageRef.current =
        smoothedProjectedUsageRef.current +
        (instantaneousProjection - smoothedProjectedUsageRef.current) *
          projectedSmoothingFactor;
    }

    projectedLapUsage = smoothedProjectedUsageRef.current;

    const result: FuelCalculation = {
      fuelLevel,
      lastLapUsage,
      currentLapUsage, // Add live usage
      projectedLapUsage, // Add projected usage
      avgLaps,
      avg10Laps,
      avgAllGreenLaps,
      minLapUsage,
      maxLapUsage,
      maxQualify: qualifyConsumption, // Return persistent qualify max
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
      lastFinishedLap:
        lapsToUse.length > 0 ? lapsToUse[0].lapNumber : undefined,
      fuelStatus,
      lapsRange,
    };

    // Only log when lap changes to avoid spam
    const state = useFuelStore.getState();
    if (result.currentLap !== state.lastLap) {
      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Lap ${result.currentLap} - Fuel: ${result.fuelLevel.toFixed(2)}L, LapsRemaining: ${result.lapsRemaining}, AvgPerLap: ${avgFuelPerLapForConsumption.toFixed(3)}L, ToFinish: ${result.fuelToFinish.toFixed(2)}L, CanFinish: ${result.canFinish}, ValidLaps: ${validLaps.length}, TotalLaps: ${totalLaps}`
        );

        // Log endurance strategy details
        if (result.stopsRemaining !== undefined) {
          console.log(
            `[Endurance] LapsRemaining: ${result.lapsRemaining}, Fuel/lap: ${avgFuelPerLapForConsumption.toFixed(2)}L, ` +
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
    // Also re-calc when lapStartFuel changes (via start of new lap)
    lapStartFuel,
    settings,
    qualifyConsumption,
  ]);

  return calculation;
}
