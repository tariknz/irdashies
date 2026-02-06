/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Hook for calculating fuel metrics from telemetry data
 * Follows irdashies pattern using useTelemetryValues and Zustand store
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useSessionLaps,
  useSessionStore,
  useTelemetryValue,
  useTotalRaceLaps,
} from '@irdashies/context';
import { useStore } from 'zustand';
import { useFuelStore, selectLapHistorySize, selectLastLapUsage } from './FuelStore';
import { FuelLapData } from '@irdashies/types';
import type { FuelCalculation, FuelCalculatorSettings } from './types';
import { useFuelLogger } from './useFuelLogger';
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
const MAX_REASONABLE_LAPS = 5000;

/** Intrinsic safety margin value (0.25 units) */
const INTRINSIC_MARGIN_VALUE = 0.25;

/** Minimum valid lap time to record (seconds) */
const MIN_LAP_TIME = 10;

/** Lap distance segments for consistent projection */
const LAP_DIST_SEGMENTS = [0.1, 0.25, 0.5, 0.75, 1.0];

/** Maximum allowed change in projected usage (percentage) */
const MAX_PROJECTION_CHANGE_PERCENT = 0.5; // 50%

/** Threshold for detecting lapDistPct reset */
const LAP_DIST_RESET_THRESHOLD = 0.5;

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
  const isOnTrack = useTelemetryValue('IsOnTrack');

  // Use centralized total race laps calculation
  const { isFixedLapRace, totalRaceLaps: calculatedTotalRaceLaps } = useTotalRaceLaps();

  // Check if current session is a Race
  const sessions = useStore(
    useSessionStore,
    (state) => state.session?.SessionInfo?.Sessions
  );
  const isRace =
    sessionNum !== undefined && sessions?.[sessionNum]?.SessionType === 'Race';

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
  const rawTrackId = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackID
  );
  const trackName = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackName
  );

  // Use TrackName as primary key to prevent ID collisions
  const trackId = trackName ?? rawTrackId;

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
  const lapHistorySize = useFuelStore(selectLapHistorySize);

  // Subscribe to last lap data directly to ensure immediate reactivity
  const storeLastLapUsage = useFuelStore(selectLastLapUsage);

  // Ref to track the currently loaded context (Track + Car) to avoid redundant clears/loads

  const loadedContextRef = useRef<string | null>(null);

  // Refs for smoothing projected lap usage
  const smoothedProjectedUsageRef = useRef<number>(0);
  const lastSmoothedLapRef = useRef<number>(-1);

  // Ref to track previous fuel level for refuel detection
  const prevFuelLevelRef = useRef<number | undefined>(undefined);

  // Ref to track previous session time for reset detection
  const lastSessionTimeRef = useRef<number | undefined>(undefined);

  // Ref to track last refuel time for debouncing
  const lastRefuelTimeRef = useRef<number | undefined>(undefined);

  // Ref to track consumption trend and segment data
  const consumptionSegmentsRef = useRef<{ distPct: number; usage: number }[]>(
    []
  );
  const lastProjectedUsageRef = useRef<number | null>(null);

  // Track lapDistPct history to detect resets

  const lapDistPctHistoryRef = useRef<number[]>([]);
  const lapDistPctResetDetectedRef = useRef(false);
  const lastValidLapDistPctRef = useRef<number | undefined>(undefined);

  // Race Finish Detection

  const [isRaceFinished, setIsRaceFinished] = useState(false);
  const checkFlagLapRef = useRef<number | null>(null);

  // --------------------------------------------------------------------------
  // Detect lapDistPct resets
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (lapDistPct === undefined) return;

    // Maintain history of last 10 values
    lapDistPctHistoryRef.current.push(lapDistPct);
    if (lapDistPctHistoryRef.current.length > 10) {
      lapDistPctHistoryRef.current.shift();
    }

    // Detect reset: if lapDistPct dropped drastically
    if (
      lastValidLapDistPctRef.current !== undefined &&
      lapDistPct < lastValidLapDistPctRef.current - LAP_DIST_RESET_THRESHOLD
    ) {
      lapDistPctResetDetectedRef.current = true;
      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] lapDistPct RESET DETECTED: ${lastValidLapDistPctRef.current.toFixed(4)} -> ${lapDistPct.toFixed(4)}`
        );
      }

      // Clear projection data when reset detected
      consumptionSegmentsRef.current = [];
      lastProjectedUsageRef.current = null;
      smoothedProjectedUsageRef.current = 0;
    }
    // If it is increasing normally after a reset, mark as non-reset
    else if (
      lapDistPctResetDetectedRef.current &&
      lastValidLapDistPctRef.current !== undefined &&
      lapDistPct > lastValidLapDistPctRef.current + 0.05
    ) {
      lapDistPctResetDetectedRef.current = false;
    }

    // Update last valid value
    lastValidLapDistPctRef.current = lapDistPct;
  }, [lapDistPct]);

  // --------------------------------------------------------------------------
  // Definitive projection calculation with reset handling
  // --------------------------------------------------------------------------

  const calculateDefinitiveProjectedUsage = useMemo(() => {
    return (
      currentLapUsage: number,
      lapDistPct: number,
      lastLapUsage: number,
      avgConsumption: number,
      qualifyConsumption: number | null,
      _lapStartFuel: number,
      _currentFuel: number,
      isLapDistPctReset: boolean
    ): number => {
      // Use appropriate historical reference

      let historicalReference = avgConsumption;
      // Prefer last lap if valid and similar to average
      if (
        lastLapUsage > 0 &&
        avgConsumption > 0 &&
        Math.abs(lastLapUsage - avgConsumption) / avgConsumption < 0.2
      ) {
        historicalReference = lastLapUsage;
      } else if (historicalReference === 0 && qualifyConsumption) {
        historicalReference = qualifyConsumption;
      }

      if (historicalReference <= 0) historicalReference = 3.2; // Fallback default

      // Detect Refuel on Out Lap

      // If we have more fuel now than at the start of the lap, it is impossible to calculate consumption
      // for the current lap. Use Historical Average to avoid drop to 0.1
      if (_currentFuel > _lapStartFuel) {
        if (DEBUG_LOGGING) {
          // console.log('[FuelCalculator] Refuel detected during lap - enforcing historical avg');
        }
        lastProjectedUsageRef.current = historicalReference;
        return historicalReference;
      }

      // If reset detected or invalid lapDistPct
      if (isLapDistPctReset || lapDistPct > 0.99 || lapDistPct < 0.001) {
        return historicalReference;
      }

      const rawProjection = currentLapUsage / lapDistPct;

      // Limit extreme values

      const minReasonable = 0.1; // Minimum 0.1L per lap
      const maxReasonable = 20.0; // Maximum 20L per lap

      const safeProjection = Math.max(
        minReasonable,
        Math.min(maxReasonable, rawProjection)
      );

      // Determine confidence based on progress
      // Increase historical weight throughout the lap.
      let confidence = 0;

      // From 0% to 50% of the lap: Confidence rises from 0.0 to 0.5 (More conservative at start)
      if (lapDistPct < 0.5) {
        confidence = (lapDistPct / 0.5) * 0.5;
      }
      // From 50% to 100% of the lap: Confidence rises from 0.5 to 0.8 (Max 80% Live)
      else {
        confidence = 0.5 + ((lapDistPct - 0.5) / 0.5) * 0.3;
      }

      // Mix projection with history
      let projected =
        safeProjection * confidence + historicalReference * (1 - confidence);

      // Apply safety margin based on confidence
      const safetyMultiplier = 1.02 + 0.05 * (1 - confidence); // Reduced margin
      projected = projected * safetyMultiplier;

      // Limit drastic variation if we already have a stable previous projection in the same lap
      if (
        lastProjectedUsageRef.current !== null &&
        lastProjectedUsageRef.current > 0
      ) {
        const maxChange =
          lastProjectedUsageRef.current * MAX_PROJECTION_CHANGE_PERCENT;
        const minAllowed =
          lastProjectedUsageRef.current * (1 - MAX_PROJECTION_CHANGE_PERCENT);
        const maxAllowed =
          lastProjectedUsageRef.current * (1 + MAX_PROJECTION_CHANGE_PERCENT);

        projected = Math.max(minAllowed, Math.min(maxAllowed, projected));
      }

      lastProjectedUsageRef.current = projected;
      return projected;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Main Telemetry Processing
  // --------------------------------------------------------------------------

  // Track current session number (preserves data across session changes)
  useEffect(() => {
    if (sessionNum !== undefined) {
      updateSessionInfo(sessionNum);
    }
  }, [sessionNum, updateSessionInfo]);

  // Detect when car goes to track to start a new log file
  const prevIsOnTrackRef = useRef(isOnTrack);

  useEffect(() => {
    const enteredCar = isOnTrack && !prevIsOnTrackRef.current;

    if (enteredCar && settings?.enableLogging) {
      console.log(
        `[FuelCalculator] Log Rotation Triggered: EnteredCar=${enteredCar}`
      );
      window.fuelCalculatorBridge.startNewLog().catch(console.error);
    }

    prevIsOnTrackRef.current = isOnTrack;
  }, [isOnTrack, settings?.enableLogging]);

  // Clear segment data at start of each lap
  useEffect(() => {
    if (lapDistPct !== undefined && lapDistPct < 0.01) {
      // Reset segment data at the very beginning of lap
      consumptionSegmentsRef.current = [];
      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Reset segment data at start of lap (lapDistPct: ${lapDistPct.toFixed(4)})`
        );
      }
    }
  }, [lapDistPct]);

  useEffect(() => {
    const currentCarName = (
      useSessionStore.getState().session?.DriverInfo as {
        DriverCarName?: string;
      }
    )?.DriverCarName;

    const currentContext =
      trackId !== undefined && currentCarName !== undefined
        ? `${trackId}:${currentCarName}`
        : null;

    const contextChanged = currentContext !== null && currentContext !== loadedContextRef.current;

    if (contextChanged) {
      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Context changed to ${currentContext}. Purging current session volatile data and loading history from DB.`
        );
      }
      
      // Update ref immediately to prevent race conditions from additional renders
      loadedContextRef.current = currentContext;

      // ALWAYS clear current volatile data ONLY when context really changes to prevent leakage
      // This ONLY clears browser memory for the current session, NOT the database historical array.
      clearAllData();
      setQualifyConsumption(null);

      if (settings?.enableStorage ?? true) {
        const [tId, cName] = currentContext.split(':');
        console.log(`[FuelCalculator] Loading historical data for: Track=${tId}, Car=${cName}`);
        
        window.fuelCalculatorBridge
          .getHistoricalLaps(tId, cName)
          .then((laps) => {
            console.log(`[FuelCalculator] Historical laps received: ${laps.length} laps for ${currentContext}`);
            // Set history (even if empty) to ensure memory is updated to the new context
            if (laps.length > 0) {
              console.log(`[FuelCalculator] First historical lap: fuelUsed=${laps[0].fuelUsed.toFixed(3)}L`);
            } else {
              console.log(`[FuelCalculator] No historical data found for this combination in DB. Starting fresh.`);
            }
            useFuelStore.getState().setLapHistory(laps);
          });

        window.fuelCalculatorBridge
          .getQualifyMax(tId, cName)
          .then((val) => {
            if (val !== null) {
              console.log(`[FuelCalculator] Loaded QualifyMax (${val}) from DB`);
              setQualifyConsumption(val);
            }
          });
      }
    }

    if (trackId !== undefined || currentCarName !== undefined) {
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

  // Update session flags state
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

  // Monitor Pit Road status
  useEffect(() => {
    if (onPitRoad) {
      wasOnPitRoadDuringLapRef.current = true;
    }
  }, [onPitRoad]);

  // Track if the ENTIRE lap was under Green Flag conditions

  // This ensures rolling start formation laps (Yellow) or caution laps are not counted
  const isLapFullyGreenRef = useRef(true);
  
  useEffect(() => {
    if (sessionFlags !== undefined) {
      if (!isGreenFlag(sessionFlags)) {
        isLapFullyGreenRef.current = false;
      }
    }
  }, [sessionFlags]);

  // Detect lap crossings and process fuel data - OPTIMIZED VERSION

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

    // Detect Refueling

    if (prevFuelLevelRef.current !== undefined) {
      const fuelDelta = fuelLevel - prevFuelLevelRef.current;
      const timeDelta = sessionTime - (lastRefuelTimeRef.current || 0);

      // Detect if: significant increase AND not recently
      if (fuelDelta > 0.05 && timeDelta > 5) {
        if (DEBUG_LOGGING)
          console.log(
            `[FuelCalculator] Refuel Detected: +${fuelDelta.toFixed(3)}L`
          );
        useFuelStore.getState().addRefuel(fuelDelta);
        lastRefuelTimeRef.current = sessionTime;
      }
    }
    prevFuelLevelRef.current = fuelLevel;

    // Track segment usage for projection
    if (state.lastLapDistPct !== undefined && lapDistPct !== undefined) {
      // Only track if not in reset state
      if (
        !lapDistPctResetDetectedRef.current &&
        lapDistPct > state.lastLapDistPct
      ) {
        const segmentUsage = state.lapStartFuel - fuelLevel;
        consumptionSegmentsRef.current.push({
          distPct: lapDistPct,
          usage: segmentUsage,
        });

        // Keep only recent segments
        if (consumptionSegmentsRef.current.length > 10) {
          consumptionSegmentsRef.current.shift();
        }
      }
    }

    // Detect lap crossing
    const distCrossing = detectLapCrossing(lapDistPct, state.lastLapDistPct);
    const lapIncremented = lap > state.lastLap;

    // Check for Session Reset
    if (lap < state.lastLap) {
      if (
        lastSessionTimeRef.current !== undefined &&
        sessionTime > lastSessionTimeRef.current
      ) {
        if (DEBUG_LOGGING)
          console.log(`[FuelCalculator] Ignored lap counter drop`);
        updateLapDistPct(lapDistPct);
        lastSessionTimeRef.current = sessionTime;
        return;
      }

      // Lap count went backwards - reset
      if (DEBUG_LOGGING)
        console.log(`[FuelCalculator] Lap reset detected, resetting state`);
      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap,
        onPitRoad === 1
      );
      lastSessionTimeRef.current = sessionTime;

      // Clear ALL projection data on lap reset
      consumptionSegmentsRef.current = [];
      lastProjectedUsageRef.current = null;
      smoothedProjectedUsageRef.current = 0;
      lapDistPctResetDetectedRef.current = false;

      return;
    }

    lastSessionTimeRef.current = sessionTime;

    const isCrossing =
      distCrossing || (lapIncremented && lap - state.lastLap === 1);

    if (isCrossing) {
      const timeSinceLastCrossing = sessionTime - state.lapCrossingTime;

      if (
        !lapIncremented &&
        timeSinceLastCrossing > 0 &&
        timeSinceLastCrossing < MIN_LAP_TIME
      ) {
        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator] Ignored crossing (time since last: ${timeSinceLastCrossing.toFixed(3)}s < ${MIN_LAP_TIME}s)`
          );
        }
        updateLapDistPct(lapDistPct);
        return;
      }

      const completedLap = lap - 1;
      const fuelUsed = state.lapStartFuel + state.accumulatedRefuel - fuelLevel;
      const lapTime = timeSinceLastCrossing;

      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] Lap ${completedLap} complete - Used: ${fuelUsed.toFixed(3)}L, Time: ${lapTime.toFixed(2)}s`
        );
      }

      // Record lap data
      if (completedLap >= 1 && fuelUsed > 0 && lapTime >= MIN_LAP_TIME) {
        const recentLaps = state.getRecentLaps(10);
        const isGreen = isLapFullyGreenRef.current;
        const isOutlier = !validateLapData(fuelUsed, lapTime, recentLaps);
        const wasTowed = wasTowedDuringLapRef.current;
        
        // Strict Validation: Only count formatted green laps for consumption stats
        // This excludes "Rolling Start" formation laps which are technically Lap 1 but Yellow
        const isValid = !wasTowed && !isOutlier && isGreen;

        const lapData: FuelLapData = {
          lapNumber: completedLap,
          fuelUsed,
          lapTime,
          isGreenFlag: isGreen,
          isValidForCalc: isValid,
          isOutLap: state.wasOnPitRoad,
          isInLap: wasOnPitRoadDuringLapRef.current,
          wasTowed,
          timestamp: Date.now(),
          sessionNum,
        };

        if (DEBUG_LOGGING || wasTowed) {
          console.log(
            `[FuelCalculator]   -> Valid: ${lapData.isValidForCalc}, Green: ${lapData.isGreenFlag}`
          );
        }

        addLapData(lapData);

        if (
          storedTrackId !== undefined &&
          storedCarName !== undefined &&
          (settings?.enableStorage ?? true)
        ) {
          window.fuelCalculatorBridge.saveLap(
            storedTrackId,
            storedCarName,
            lapData
          );
        }
      }

      // Reset flags for new lap
      wasTowedDuringLapRef.current = false;
      wasOnPitRoadDuringLapRef.current = false;

      // Clear ALL projection data for new lap
      consumptionSegmentsRef.current = [];
      lastProjectedUsageRef.current = null;
      smoothedProjectedUsageRef.current = 0;
      lastSmoothedLapRef.current = -1;
      lapDistPctResetDetectedRef.current = false;

      const nextLap = Math.max(lap, completedLap + 1);

      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        nextLap,
        onPitRoad === 1
      );

      if (DEBUG_LOGGING) {
        console.log(`[FuelCalculator] Starting lap ${nextLap} - ALL projection data cleared`);
      }
      
      // Reset Green Flag tracking for the NEW lap
      // Initialize with current flag state (if currently green, start true)
      isLapFullyGreenRef.current = isGreenFlag(sessionFlags);
    } else if (state.lastLapDistPct === 0) {
      // Initialize
      updateLapCrossing(
        lapDistPct,
        fuelLevel,
        sessionTime,
        lap,
        onPitRoad === 1
      );
    } else {
      // Always update distance
      updateLapDistPct(lapDistPct);
    }
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
    sessionNum,
    storedTrackId,
    storedCarName,
    settings?.enableStorage
  ]);

  // Track Max Qualifying Consumption
  useEffect(() => {
    const currentSessionType = useSessionStore
      .getState()
      .session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.SessionType;

    const isQualifying =
      currentSessionType && currentSessionType.includes('Qualify');

    if (isQualifying) {
      const lapHistory = useFuelStore.getState().getLapHistory();

      const allCandidates = lapHistory.filter((l) => !l.wasTowed);
      const fullLaps = allCandidates.filter((l) => !l.isOutLap);

      const lapsToUse = fullLaps.length > 0 ? fullLaps : allCandidates;

      const sessionLaps = allCandidates.filter(
        (l) => !l.isHistorical && l.sessionNum === sessionNum
      );
      const qualifyLapsToUse =
        sessionLaps.length > 0
          ? sessionLaps.filter((l) => !l.isOutLap).length > 0
            ? sessionLaps.filter((l) => !l.isOutLap)
            : sessionLaps
          : lapsToUse;

      if (qualifyLapsToUse.length > 0) {
        const maxFuelUsed = Math.max(
          ...qualifyLapsToUse.map((l) => l.fuelUsed)
        );

        if (qualifyConsumption === null || maxFuelUsed !== qualifyConsumption) {
          if (DEBUG_LOGGING)
            console.log(
              `[FuelCalculator] Updating Qualify Max: ${qualifyConsumption} -> ${maxFuelUsed}`
            );
          setQualifyConsumption(maxFuelUsed);

          if (
            storedTrackId !== undefined &&
            storedCarName !== undefined &&
            (settings?.enableStorage ?? true)
          ) {
            window.fuelCalculatorBridge.saveQualifyMax(
              storedTrackId,
              storedCarName,
              maxFuelUsed
            );
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
  ]);

  // Monitor for Race Finish
  useEffect(() => {
    if (
      sessionFlags === undefined ||
      lap === undefined ||
      lapDistPct === undefined
    )
      return;

    // Determine if we are in a "Post-Race" context
    const isCheckered = isCheckeredFlag(sessionFlags);
    // Also consider State 5 (Checkered) or 6 (Cooldown) as definitive finish states
    const isPostRaceState = sessionState !== undefined && sessionState >= 5;

    if (isCheckered || isPostRaceState) {
      if (checkFlagLapRef.current === null) {
        // First time seeing Checkered Flag/State
        checkFlagLapRef.current = lap;

        // If we see the flag at the very start of a lap (< 5%), it implies we
        // just crossed the line to trigger it (or crossed while it was waving).
        const isLongCooldown =
          sessionTimeRemain !== undefined &&
          sessionTimeRemain > 300 &&
          isPostRaceState;

        if (lapDistPct < 0.05 || isLongCooldown) {
          setIsRaceFinished(true);
          if (DEBUG_LOGGING)
            console.log('[FuelCalculator] Race Finished detected (Immediate)');
        }
      } else {
        // Already tracking checkered state
        // If we incremented lap since first seeing checkered flag, we are definitely done
        if (lap > checkFlagLapRef.current) {
          setIsRaceFinished(true);
          if (DEBUG_LOGGING)
            console.log(
              '[FuelCalculator] Race Finished detected (Lap Crossed)'
            );
        }
      }
    } else {
      // Reset if flags clear (new session, restart)
      if (checkFlagLapRef.current !== null) {
        setIsRaceFinished(false);
        checkFlagLapRef.current = null;
      }
    }
  }, [sessionFlags, sessionState, lap, lapDistPct, sessionTimeRemain]);

  // Calculate fuel metrics
  const baseCalculation = useMemo((): FuelCalculation | null => {
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
      fuelTankCapacity: 60,
      fuelStatus: 'safe',
      maxQualify: qualifyConsumption,
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

    // Get lap history
    const lapHistory = useFuelStore.getState().getLapHistory();

    if (lapHistory.length < 1) {
      return emptyCalculation;
    }

    // Use lapStartFuel for current lap usage
    const currentLapUsage =
      lapStartFuel > 0 ? Math.max(0, lapStartFuel - fuelLevel) : 0;

    // Filter valid laps
    const validLaps = lapHistory.filter((l) => l.isValidForCalc);
    if (validLaps.length === 0) return { ...emptyCalculation, currentLapUsage };

    // Get tank capacity - SOLUTION 1 + 5
    const calculateRealTankCapacity = () => {
      // Priority 1: Session data
      if (fuelTankCapacityFromSession && fuelTankCapacityFromSession > 0) {
        return fuelTankCapacityFromSession;
      }

      // Priority 2: Estimate from maximum observed
      const maxObservedFuel = Math.max(
        ...validLaps.map((l) => l.fuelUsed * 2), // Assume maximum usage of 50% per lap
        fuelLevel * 3, // Assume at least 1/3 of the tank
        DEFAULT_TANK_CAPACITY
      );

      // Priority 3: Use fuelLevelPct with verification
      if (fuelLevelPct && fuelLevelPct > 0.01 && fuelLevelPct < 0.99) {
        const calculated = fuelLevel / fuelLevelPct;
        if (calculated > fuelLevel * 1.1 && calculated < fuelLevel * 50) {
          // Sanity check (Solution 5)
          return Math.min(200, calculated);
        }
      }

      return DEFAULT_TANK_CAPACITY;
    };

    const fuelTankCapacity = calculateRealTankCapacity();

    // Exclude out-laps AND in-laps
    const fullLaps = validLaps.filter((l) => !l.isOutLap && !l.isInLap);
    const lapsToUse = fullLaps.length > 0 ? fullLaps : validLaps;

    // Get different lap groupings
    const greenLaps = getGreenFlagLaps(lapsToUse);
    const avgLapsCount = settings?.avgLapsCount || 3;
    const lastLapsForAvg = lapsToUse.slice(0, avgLapsCount);
    const last10 = lapsToUse.slice(0, 10);

    // Calculate averages - use reactive store value for immediate update
    // storeLastLapUsage is subscribed directly and updates immediately when addLapData is called
    const lastLapUsage = storeLastLapUsage > 0 
      ? storeLastLapUsage 
      : (lapHistory.length > 0 ? lapHistory[0].fuelUsed : 0);

    const avgLaps =
      lastLapsForAvg.length > 0
        ? calculateSimpleAverage(lastLapsForAvg)
        : lastLapUsage;
    const avg10Laps =
      last10.length > 0 ? calculateSimpleAverage(last10) : avgLaps;
    const avgAllGreenLaps =
      greenLaps.length > 0 ? calculateSimpleAverage(greenLaps) : avg10Laps;

    // Calculate min and max
    const validSessionLaps = validLaps.filter((l) => !l.isHistorical);
    const maxSourceLaps =
      validSessionLaps.length > 0 ? validSessionLaps : validLaps;
    const { min: minLapUsage, max: maxLapUsage } =
      findFuelMinMax(maxSourceLaps);

    // Use customizable average as primary metric
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

    if (avgFuelPerLapBase <= 0) {
      // Emergency Live Estimation (First Lap)
      // Allow early estimation if we have traveled at least 5% of the lap and used some fuel
      if (currentLapUsage > 0 && (lapDistPct || 0) > 0.05) {
         let liveProj = currentLapUsage / (lapDistPct || 1);
         // Loose sanity clamps (0.5L to 20L per lap)
         liveProj = Math.max(0.5, Math.min(20.0, liveProj));
         
         avgFuelPerLapBase = liveProj;
         avgFuelPerLapForConsumption = liveProj;
         
         if (DEBUG_LOGGING) {
            console.log(`[FuelCalculator] Using LIVE estimation: ${liveProj.toFixed(3)} L/Lap`);
         }
      } else {
         return null;
      }
    }

    // Calculate average lap time
    let avgLapTime = calculateAvgLapTime(lapsToUse);

    if (avgLapTime <= 0) {
      const historicalLaps = lapHistory.filter(
        (l) => l.isHistorical && !l.isOutLap && !l.isInLap
      );
      if (historicalLaps.length > 0) {
        avgLapTime = calculateAvgLapTime(historicalLaps.slice(0, 5));
      }
    }

    // Calculate consumption trend
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
    const trendAdjustedConsumption =
      avgFuelPerLapForConsumption * (1 + Math.max(0, consumptionTrend) / 100); // Only apply positive trends

    // Calculate laps possible with current fuel - use trend-adjusted for safety
    const lapsWithFuel =
      trendAdjustedConsumption > 0 ? fuelLevel / trendAdjustedConsumption : 0;

    // Calculate remaining distance in current lap
    const currentLapRemainingPct = Math.max(0, 1 - (lapDistPct || 0));

    // Determine laps remaining
    // sessionLapsRemain counts COMPLETE laps remaining after finishing current
    // For fuel calculation, we need to add the remaining portion of THIS lap
    let lapsRemaining = (sessionLapsRemain || 0) + currentLapRemainingPct;
    // Separate variable for Refuel calculations (adds safety buffer)
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
      totalLaps = lap + 1;

      if (DEBUG_LOGGING) {
        console.log(
          `[FuelCalculator] ${isCheckeredFlag(sessionFlags) ? 'Checkered' : 'White'} flag - final lap, remaining: ${lapsRemaining.toFixed(2)}`
        );
      }
    } else if (sessionLapsRemain === TIMED_RACE_LAPS_REMAINING) {
      // Use centralized useTotalRaceLaps hook for timed race calculations
      if (calculatedTotalRaceLaps > 0) {
        // Use the hook's result directly
        totalLaps = Math.ceil(calculatedTotalRaceLaps);
        lapsRemaining = Math.max(0, totalLaps - (lap - 1) - (lapDistPct || 0));
        
        // Add safety buffer for refuel calculations
        const TIME_PADDING_REFUEL = 45.0;
        const avgLapTimeForBuffer = avgLapTime > 0 ? avgLapTime : 90; // Default 90s if unknown
        const bufferLaps = TIME_PADDING_REFUEL / avgLapTimeForBuffer;
        lapsRemainingRefuel = lapsRemaining + bufferLaps;

        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator] Timed race (via useTotalRaceLaps): totalLaps=${totalLaps}, lapsRemaining=${lapsRemaining.toFixed(2)}, refuel=${lapsRemainingRefuel.toFixed(2)}`
          );
        }
      } else if (sessionTimeRemain !== undefined && sessionTimeRemain > 0) {
        // Fallback to local calculation if hook didn't return a valid value
        let projectionLapTime = avgLapTime;

        if (lapsToUse.length >= 3) {
          const recentLapsForProj = lapsToUse.slice(0, 3);
          const recentAvg = calculateAvgLapTime(recentLapsForProj);
          if (recentAvg > 0 && recentAvg < projectionLapTime) {
            projectionLapTime = recentAvg;
          }
        }

        if (projectionLapTime > 0) {
          const pctRemainingInLap = Math.max(0, 1 - (lapDistPct || 0));
          const timeToFinishLap = projectionLapTime * pctRemainingInLap;
          const timeAtLine = sessionTimeRemain - timeToFinishLap;
          const TIME_PADDING_SECONDS = 0.5;
          const TIME_PADDING_REFUEL = 45.0;

          let futureLaps = 0;
          let futureLapsRefuel = 0;

          if (timeAtLine < -TIME_PADDING_SECONDS) {
            lapsRemaining = 1;
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
          const estimatedLapsFromFuel =
            trendAdjustedConsumption > 0
              ? Math.floor(fuelLevel / trendAdjustedConsumption)
              : 0;
          lapsRemaining = Math.max(1, Math.min(estimatedLapsFromFuel, 50));
          lapsRemainingRefuel = lapsRemaining;
        }

        if (avgLapTime <= 0) {
          totalLaps = lap + lapsRemaining;
        }

        if (DEBUG_LOGGING) {
          console.log(
            `[FuelCalculator] Timed race (fallback): estimated laps: ${lapsRemaining}, refuel laps: ${lapsRemainingRefuel}`
          );
        }
      } else {
        if (sessionTimeRemain === -1) {
          const estimatedLapsFromFuel =
            trendAdjustedConsumption > 0
              ? Math.floor(fuelLevel / trendAdjustedConsumption)
              : 0;
          lapsRemaining = Math.max(1, Math.min(estimatedLapsFromFuel, 50));
          lapsRemainingRefuel = lapsRemaining;
          totalLaps = lap + lapsRemaining;

          if (DEBUG_LOGGING) {
            console.log(
              `[FuelCalculator] Timed race (Time=-1), fallback to fuel est: ${lapsRemaining}`
            );
          }
        } else {
          const remainingDistance = Math.max(0, 1 - (lapDistPct || 0));
          lapsRemaining = remainingDistance;
          lapsRemainingRefuel = lapsRemaining;
          totalLaps = lap + 1;

          if (DEBUG_LOGGING) {
            console.log(
              `[FuelCalculator] Timed race ended (Time<=0), completing current lap. Rem: ${lapsRemaining.toFixed(2)}`
            );
          }
        }
      }
    } else {
      // Not a timed race, sync refuel count
      lapsRemainingRefuel = lapsRemaining;
    }

    // Guard against invalid lapsRemaining - SOLUTION 5
    // Sanity check para lapsRemaining
    if (lapsRemaining > 1000) {
      console.warn(
        `[FuelCalculator] Unrealistic lapsRemaining (${lapsRemaining}) capped at 1000`
      );
      lapsRemaining = 1000;
      lapsRemainingRefuel = 1000;
    }

    if (
      !Number.isFinite(lapsRemaining) ||
      lapsRemaining < 0 ||
      lapsRemaining > MAX_REASONABLE_LAPS
    ) {
      if (sessionLapsRemain !== TIMED_RACE_LAPS_REMAINING) {
        lapsRemaining = sessionLapsRemain;
        lapsRemainingRefuel = sessionLapsRemain;
      } else {
        return null;
      }
    }

    // Enhanced confidence calculation
    // Enhanced confidence calculation
    const calculateConfidence = () => {
      if (validLaps.length >= 8) return 'high';
      if (validLaps.length >= 4) return 'medium';
      if (validLaps.length >= 2) return 'low';
      // If we have <= 1 valid lap (or are using live estimate), it is very-low
      // This covers the "Live Estimate" case we enabled above
      return 'very-low';
    };

    const confidence = calculateConfidence();

    // Adjust safety margin based on confidence
    const confidenceMultiplier =
      {
        'very-low': 1.5,
        low: 1.3,
        medium: 1.15,
        high: 1.0,
      }[confidence] || 1.0;

    // Calculate fuel needed with dynamic safety margin
    const marginAmount =
      settings?.fuelUnits === 'gal' ? safetyMargin * 3.78541 : safetyMargin;
    const intrinsicMargin =
      settings?.fuelUnits === 'gal'
        ? INTRINSIC_MARGIN_VALUE * 3.78541
        : INTRINSIC_MARGIN_VALUE;

    const adjustedMargin =
      (marginAmount + intrinsicMargin) * confidenceMultiplier;

    // CRITICAL FIX: Use lapsRemainingRefuel (Optimistic) for fuel calculation
    const fuelNeeded =
      lapsRemainingRefuel * trendAdjustedConsumption + adjustedMargin;
    const canFinish = fuelLevel >= fuelNeeded;

    // Calculate pit window with trend adjustment
    const pitWindowOpen = lap + 1;
    const pitWindowClose = Math.max(
      pitWindowOpen,
      lap + Math.floor(lapsWithFuel * 0.8)
    ); // 80% of estimated laps

    // Target consumption for fuel saving (Use realistic lapsRemaining)
    const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

    // Calculate fuel at finish
    const fuelAtFinish = fuelLevel - lapsRemaining * trendAdjustedConsumption;

    // Consistent projected lap usage with reset detection
    let projectedLapUsage = 0;

    // Reset smoothing when lap changes
    if (lastSmoothedLapRef.current !== lap) {
      smoothedProjectedUsageRef.current = 0;
      lastSmoothedLapRef.current = lap || 0;
      if (DEBUG_LOGGING) {
        console.log(`[FuelCalculator] Reset smoothing for lap ${lap}`);
      }
    }

    // Use definitive projection calculation with reset detection
    const isLapDistPctReset = lapDistPctResetDetectedRef.current;
    const definitiveProjection = calculateDefinitiveProjectedUsage(
      currentLapUsage,
      lapDistPct || 0,
      lastLapUsage,
      avgLaps,
      qualifyConsumption,
      lapStartFuel,
      fuelLevel,
      isLapDistPctReset
    );

    // Apply smoothing with adaptive factor
    const baseSmoothingFactor = 0.1;
    let progressBasedFactor = Math.min(
      0.3,
      baseSmoothingFactor * (1 + (lapDistPct || 0) * 2)
    );

    // DAMPENING AT END OF LAP: Reduce sensitivity near finish line to prevent spikes
    // driven by final corner acceleration or lap distance anomalies.
    if ((lapDistPct || 0) > 0.9) {
      progressBasedFactor = 0.05; // Very slow updates at end of lap to lock in value
    }

    if (smoothedProjectedUsageRef.current === 0) {
      smoothedProjectedUsageRef.current = definitiveProjection;
    } else {
      // Clamp the change to prevent massive spikes in a single frame
      const maxChange = 0.2; // Max 0.2L change per update
      let targetValue = definitiveProjection;

      const potentialChange = targetValue - smoothedProjectedUsageRef.current;
      if (Math.abs(potentialChange) > maxChange) {
        targetValue =
          smoothedProjectedUsageRef.current +
          Math.sign(potentialChange) * maxChange;
      }

      smoothedProjectedUsageRef.current =
        smoothedProjectedUsageRef.current +
        (targetValue - smoothedProjectedUsageRef.current) * progressBasedFactor;
    }

    projectedLapUsage = smoothedProjectedUsageRef.current;

    // Detailed log for debug
    if (DEBUG_LOGGING) {
      if (isLapDistPctReset) {
        console.log(
          `[FuelCalculator] RESET STATE - lapDistPct: ${lapDistPct?.toFixed(4)}, ` +
            `Projection: ${projectedLapUsage.toFixed(3)}L, ` +
            `Using lastLapUsage: ${lastLapUsage.toFixed(3)}L`
        );
      } else if (lap !== useFuelStore.getState().lastLap) {
        console.log(`[FuelCalculator] DEBUG:`, {
          fuelLevel,
          fuelLevelPct,
          tankCapacity: fuelTankCapacity,
          calculatedFromPct:
            fuelLevelPct && fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : 'N/A',
          driverCarFuelMaxLtr,
          driverCarMaxFuelPct,
          sessionLapsRemain,
          sessionTimeRemain,
          avgLapTime,
          lapsRemaining: lapsRemaining,
          calculatedProjection: definitiveProjection,
        });
      }
    }

    // Calculate laps range with trend adjustment
    const lapsRange: [number, number] = [
      Math.max(0, Math.floor(lapsRemaining * 0.9)), // -10%
      Math.ceil(lapsRemaining * 1.1) + 1, // +10%
    ];

    // Calculate fuel status with trend awareness
    const statusThresholds = settings?.fuelStatusThresholds || {
      green: 60,
      amber: 30,
      red: 10,
    };
    const statusBasis = settings?.fuelStatusBasis || 'avg';
    const redLapsThreshold = settings?.fuelStatusRedLaps ?? 3;

    let fuelStatus: 'safe' | 'caution' | 'danger' = 'safe';

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

    const effectiveStatusThresholds = isQualifyingOrPractice
      ? { green: 20, amber: 10, red: 5 }
      : statusThresholds;

    if (currentFuelPctValue >= effectiveStatusThresholds.green) {
      fuelStatus = 'safe';
    } else if (currentFuelPctValue >= effectiveStatusThresholds.amber) {
      fuelStatus = 'caution';
    } else {
      fuelStatus = 'danger';
    }

    // Laps remaining override with trend-adjusted consumption
    const basisUsageValue =
      statusBasis === 'max'
        ? maxLapUsage
        : statusBasis === 'min'
          ? minLapUsage
          : statusBasis === 'last'
            ? lastLapUsage
            : trendAdjustedConsumption;

    const lapsLeftOnBasis =
      basisUsageValue > 0 ? fuelLevel / basisUsageValue : 0;

    const effectiveRedLaps = isQualifyingOrPractice
      ? Math.min(redLapsThreshold, 1)
      : redLapsThreshold;

    if (lapsLeftOnBasis < effectiveRedLaps && lapsLeftOnBasis > 0) {
      fuelStatus = 'danger';
    } else if (
      isQualifyingOrPractice &&
      lapsLeftOnBasis < 2 &&
      fuelStatus === 'safe'
    ) {
      fuelStatus = 'caution';
    }

    // Calculate stops remaining with trend adjustment
    let stopsRemaining: number | undefined;
    let lapsPerStint: number | undefined;

    if (fuelTankCapacity > 0 && trendAdjustedConsumption > 0) {
      lapsPerStint = fuelTankCapacity / trendAdjustedConsumption;
    }

    if (
      lapsRemaining > 0 &&
      fuelTankCapacity > 0 &&
      trendAdjustedConsumption > 0 &&
      fuelLevel >= 0
    ) {
      if (fuelLevel >= fuelNeeded) {
        stopsRemaining = 0;
      } else {
        const fuelDeficit = fuelNeeded - fuelLevel;
        stopsRemaining = Math.ceil(fuelDeficit / fuelTankCapacity);
      }
    }

    // Calculate fuel to add
    let fuelToAdd = 0;
    if (stopsRemaining !== undefined && stopsRemaining > 1) {
      // More than 1 stop: Fill to capacity
      fuelToAdd = Math.max(0, fuelTankCapacity - fuelLevel);
    } else {
      // 0 or 1 stop: Add exactly what is needed to finish
      // We calculate the total deficit.
      // We do NOT clamp to tank capacity here immediately, because this value
      // typically represents "amount to add at the next stop".
      // If the deficit > capacity, stopsRemaining should have been > 1.
      fuelToAdd = Math.max(0, fuelNeeded - fuelLevel);
    }

    // Calculate target scenarios
    const targetScenarios: FuelCalculation['targetScenarios'] = [];
    if (lapsWithFuel >= 0.5) {
      const currentLapTarget = Math.floor(lapsWithFuel);
      const scenarios: number[] = [];

      if (currentLapTarget > 1) {
        scenarios.push(currentLapTarget - 1);
      }
      scenarios.push(currentLapTarget);
      scenarios.push(currentLapTarget + 1);

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

    // Calculate earliest pit lap
    let earliestPitLap: number | undefined;
    if (
      stopsRemaining !== undefined &&
      stopsRemaining > 0 &&
      lapsPerStint !== undefined &&
      lapsPerStint > 0
    ) {
      const maxLapsWithAllStops = lapsPerStint * stopsRemaining;
      const excessCapacity = maxLapsWithAllStops - lapsRemaining;

      if (excessCapacity >= 0) {
        earliestPitLap = lap + 1;
      } else {
        const minLapsBeforePit = Math.ceil(-excessCapacity);
        earliestPitLap = lap + Math.max(1, minLapsBeforePit);
      }

      if (earliestPitLap > pitWindowClose) {
        earliestPitLap = Math.floor(pitWindowClose);
      }
    }

    const result: FuelCalculation = {
      fuelLevel,
      lastLapUsage,
      currentLapUsage,
      projectedLapUsage,
      avgLaps,
      avg10Laps,
      avgAllGreenLaps,
      minLapUsage,
      maxLapUsage,
      maxQualify: qualifyConsumption,
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

    return result;
  }, [sessionNum, fuelLevel, fuelLevelPct, lap, sessionLapsRemain, sessionLaps, sessionTimeRemain, sessionTimeTotal, sessionFlags, driverCarFuelMaxLtr, driverCarMaxFuelPct, safetyMargin, lapStartFuel, settings, qualifyConsumption, fuelTankCapacityFromSession, calculateDefinitiveProjectedUsage, lapDistPct, storeLastLapUsage, calculatedTotalRaceLaps]);

  // Wrap calculation to apply overrides (Race Finish)
  const calculation = useMemo(() => {
    if (!baseCalculation) return null;

    if (isRaceFinished) {
      return {
        ...baseCalculation,
        lapsRemaining: 0,
        fuelToFinish: 0,
        fuelToAdd: 0,
        canFinish: true,
        fuelStatus: 'safe' as const,
        stopsRemaining: 0,
        confidence: 'high' as const, // Force type compatibility
      };
    }

    return baseCalculation;
  }, [baseCalculation, isRaceFinished]);

  // LOGGING
  const debugData = useMemo(
    () => ({
      inputs: {
        fuelLevel,
        fuelLevelPct,
        lap,
        lapDistPct,
        sessionLapsRemain,
        sessionTimeRemain,
        sessionLaps,
        sessionFlags,
        sessionState,
      },
      internal: {
        lapStartFuel: useFuelStore.getState().lapStartFuel,
        lapHistorySize,
        storedTrackId,
        storedCarName,
        qualifyConsumption,
        lapDistPctResetDetected: lapDistPctResetDetectedRef.current,
      },
      calculation,
    }),
    [
      fuelLevel,
      fuelLevelPct,
      lap,
      lapDistPct,
      sessionLapsRemain,
      sessionTimeRemain,
      sessionLaps,
      sessionFlags,
      sessionState,
      lapHistorySize,
      storedTrackId,
      storedCarName,
      qualifyConsumption,
      calculation,
    ]
  );

  useFuelLogger(isRace && isOnTrack ? debugData : null, settings);

  return calculation;
}
