/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-assignment */
/**
 * Hook for calculating fuel metrics from telemetry data
 * Applies renderer settings to the main-process fuel projection snapshot.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFuelProjectionSnapshot } from '@irdashies/context';
import { useFuelStore, selectLapHistorySize } from './FuelStore';
import type { FuelCalculation, FuelCalculatorSettings } from './types';
import { useFuelLogger } from './useFuelLogger';
import {
  calculateSimpleAverage,
  calculateAvgLapTime,
  findFuelMinMax,
  getGreenFlagLaps,
  isFinalLap,
  isCheckeredFlag,
} from './fuelCalculations';
import logger from '@irdashies/utils/logger';

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

/** Lap distance segments for consistent projection */
const LAP_DIST_SEGMENTS = [0.1, 0.25, 0.5, 0.75, 1.0];

export function useFuelCalculation(
  safetyMargin = 0.3,
  settings?: FuelCalculatorSettings
): FuelCalculation | null {
  const projection = useFuelProjectionSnapshot();
  const fuelLevel = projection?.fuelLevel;
  const fuelLevelPct = projection?.fuelLevelPct;
  const lap = projection?.currentLap;
  const lapDistPct = projection?.lapDistPct;
  const sessionLapsRemain = projection?.sessionLapsRemain;
  const sessionTimeRemain = projection?.sessionTimeRemain;
  const sessionTimeTotal = projection?.sessionTimeTotal;
  const sessionFlags = projection?.sessionFlags;
  const sessionNum = projection?.sessionNum;
  const sessionState = projection?.sessionState;
  const sessionLaps = projection?.sessionLaps;
  const isOnTrack = projection?.isOnTrack;
  const isFixedLapRace = projection?.isFixedLapRace ?? false;
  const calculatedTotalRaceLaps = projection?.calculatedTotalRaceLaps ?? 0;
  const estimatedLapsRemaining = projection?.estimatedLapsRemaining ?? 0;
  const hasValidRaceEstimate = projection?.hasValidRaceEstimate ?? false;
  const isRace = projection?.sessionType === 'Race';
  const fuelTankCapacityFromSession = projection?.fuelTankCapacity;
  const trackId = projection?.trackId;

  // Store actions (stable references)
  const updateSessionInfo = useFuelStore((state) => state.updateSessionInfo);
  const clearAllData = useFuelStore((state) => state.clearAllData);
  const setContextInfo = useFuelStore((state) => state.setContextInfo);
  const storedTrackId = useFuelStore((state) => state.trackId);
  const storedCarName = useFuelStore((state) => state.carName);

  // Persistent qualify store
  const qualifyConsumption = useFuelStore((state) => state.qualifyConsumption);
  const setQualifyConsumption = useFuelStore(
    (state) => state.setQualifyConsumption
  );

  // Subscribe to lapStartFuel to calculate live usage
  const lapStartFuel = projection?.engine.lapStartFuel ?? 0;

  // Subscribe to lap history size to trigger recalculation when laps are added
  const lapHistorySize = useFuelStore(selectLapHistorySize);

  // Ref to track the currently loaded context (Track + Car) to avoid redundant clears/loads

  const loadedContextRef = useRef<string | null>(null);
  const savedLapKeysRef = useRef(new Set<string>());
  const pendingLapKeysRef = useRef(new Set<string>());

  // Race Finish Detection

  const [isRaceFinished, setIsRaceFinished] = useState(false);
  const checkFlagLapRef = useRef<number | null>(null);

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
      logger.info(
        `[FuelCalculator] Log Rotation Triggered: EnteredCar=${enteredCar}`
      );
      window.fuelCalculatorBridge.startNewLog().catch(logger.error);
    }

    prevIsOnTrackRef.current = isOnTrack;
  }, [isOnTrack, settings?.enableLogging]);

  useEffect(() => {
    const currentCarName = projection?.carName;

    const storageContext =
      trackId !== undefined && currentCarName !== undefined
        ? `${trackId}:${currentCarName}`
        : null;
    const currentContext = storageContext
      ? `${projection?.isReplay ? 'replay' : 'live'}:${storageContext}`
      : null;

    const contextChanged =
      currentContext !== null && currentContext !== loadedContextRef.current;

    if (contextChanged) {
      if (DEBUG_LOGGING) {
        logger.info(
          `[FuelCalculator] Context changed to ${currentContext}. Purging current session volatile data and loading history from DB.`
        );
      }

      // Update ref immediately to prevent race conditions from additional renders
      loadedContextRef.current = currentContext;
      savedLapKeysRef.current.clear();
      pendingLapKeysRef.current.clear();

      // ALWAYS clear current volatile data ONLY when context really changes to prevent leakage
      // This ONLY clears browser memory for the current session, NOT the database historical array.
      clearAllData();
      setQualifyConsumption(null);

      if ((settings?.enableStorage ?? true) && !projection?.isReplay) {
        const [tId, cName] = storageContext?.split(':') ?? [];
        logger.info(
          `[FuelCalculator] Loading historical data for: Track=${tId}, Car=${cName}`
        );

        window.fuelCalculatorBridge
          .getHistoricalLaps(tId, cName)
          .then((laps) => {
            logger.info(
              `[FuelCalculator] Historical laps received: ${laps.length} laps for ${currentContext}`
            );
            // Set history (even if empty) to ensure memory is updated to the new context
            if (laps.length > 0) {
              logger.info(
                `[FuelCalculator] First historical lap: fuelUsed=${laps[0].fuelUsed.toFixed(3)}L`
              );
            } else {
              logger.info(
                `[FuelCalculator] No historical data found for this combination in DB. Starting fresh.`
              );
            }
            useFuelStore.getState().setLapHistory(laps);
          });

        window.fuelCalculatorBridge.getQualifyMax(tId, cName).then((val) => {
          if (val !== null) {
            logger.info(`[FuelCalculator] Loaded QualifyMax (${val}) from DB`);
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
    projection?.carName,
    projection?.isReplay,
  ]);

  useEffect(() => {
    if (!projection) return;
    const state = useFuelStore.getState();
    state.setProjectionLaps(projection.completedLaps);
    useFuelStore.setState(projection.engine);
  }, [projection]);

  useEffect(() => {
    const persistence = window.fuelCalculatorBridge;
    if (
      !persistence ||
      !(settings?.enableStorage ?? true) ||
      projection?.isReplay ||
      projection?.trackId === undefined ||
      projection.carName === undefined ||
      storedTrackId !== projection.trackId ||
      storedCarName !== projection.carName
    ) {
      return;
    }
    for (const completed of projection?.completedLaps ?? []) {
      const key = `${projection.trackId}:${projection.carName}:${completed.sessionNum ?? -1}:${completed.lapNumber}:${completed.timestamp ?? 0}`;
      if (
        savedLapKeysRef.current.has(key) ||
        pendingLapKeysRef.current.has(key)
      ) {
        continue;
      }
      pendingLapKeysRef.current.add(key);
      persistence
        .saveLap(projection.trackId, projection.carName, completed)
        .then(() => savedLapKeysRef.current.add(key))
        .catch(logger.error)
        .finally(() => pendingLapKeysRef.current.delete(key));
    }
  }, [
    projection?.completedLaps,
    projection?.carName,
    projection?.isReplay,
    projection?.trackId,
    settings?.enableStorage,
    storedCarName,
    storedTrackId,
  ]);

  // Track Max Qualifying Consumption
  useEffect(() => {
    const currentSessionType = projection?.sessionType;

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
            logger.info(
              `[FuelCalculator] Updating Qualify Max: ${qualifyConsumption} -> ${maxFuelUsed}`
            );
          setQualifyConsumption(maxFuelUsed);

          if (
            storedTrackId !== undefined &&
            storedCarName !== undefined &&
            (settings?.enableStorage ?? true) &&
            !projection?.isReplay
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
    projection?.sessionType,
    projection?.isReplay,
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
            logger.info('[FuelCalculator] Race Finished detected (Immediate)');
        }
      } else {
        // Already tracking checkered state
        // If we incremented lap since first seeing checkered flag, we are definitely done
        if (lap > checkFlagLapRef.current) {
          setIsRaceFinished(true);
          if (DEBUG_LOGGING)
            logger.info(
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
    const liveLapNumbers = new Set(
      projection?.completedLaps.map((completed) => completed.lapNumber) ?? []
    );
    const historicalLaps = useFuelStore
      .getState()
      .getLapHistory()
      .filter(
        (completed) =>
          completed.isHistorical && !liveLapNumbers.has(completed.lapNumber)
      );
    const lapHistory = [
      ...(projection?.completedLaps ?? []),
      ...historicalLaps,
    ].sort(
      (a, b) =>
        (b.timestamp ?? 0) - (a.timestamp ?? 0) || b.lapNumber - a.lapNumber
    );

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
    const lastLapUsage =
      projection?.lastLapUsage ??
      (lapHistory.length > 0 ? lapHistory[0].fuelUsed : 0);

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
          logger.info(
            `[FuelCalculator] Using LIVE estimation: ${liveProj.toFixed(3)} L/Lap`
          );
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
        logger.info(
          `[FuelCalculator] ${isCheckeredFlag(sessionFlags) ? 'Checkered' : 'White'} flag - final lap, remaining: ${lapsRemaining.toFixed(2)}`
        );
      }
    } else if (sessionLapsRemain === TIMED_RACE_LAPS_REMAINING) {
      // Use centralized useTotalRaceLaps hook for timed race calculations
      if (hasValidRaceEstimate && calculatedTotalRaceLaps > 0) {
        // Use the hook's result directly
        totalLaps = Math.ceil(calculatedTotalRaceLaps);
        lapsRemaining = estimatedLapsRemaining;

        // Add safety buffer for refuel calculations
        const TIME_PADDING_REFUEL = 45.0;
        const avgLapTimeForBuffer = avgLapTime > 0 ? avgLapTime : 90; // Default 90s if unknown
        const bufferLaps = TIME_PADDING_REFUEL / avgLapTimeForBuffer;
        lapsRemainingRefuel = lapsRemaining + bufferLaps;

        if (DEBUG_LOGGING) {
          logger.info(
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
          logger.info(
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
            logger.info(
              `[FuelCalculator] Timed race (Time=-1), fallback to fuel est: ${lapsRemaining}`
            );
          }
        } else {
          const remainingDistance = Math.max(0, 1 - (lapDistPct || 0));
          lapsRemaining = remainingDistance;
          lapsRemainingRefuel = lapsRemaining;
          totalLaps = lap + 1;

          if (DEBUG_LOGGING) {
            logger.info(
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
      logger.debug(
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

    const projectedLapUsage = projection?.projectedLapUsage ?? 0;

    // Detailed log for debug
    if (DEBUG_LOGGING) {
      if (projection?.engine.isLapDistPctReset) {
        logger.info(
          `[FuelCalculator] RESET STATE - lapDistPct: ${lapDistPct?.toFixed(4)}, ` +
            `Projection: ${projectedLapUsage.toFixed(3)}L, ` +
            `Using lastLapUsage: ${lastLapUsage.toFixed(3)}L`
        );
      } else if (lap !== useFuelStore.getState().lastLap) {
        logger.info(`[FuelCalculator] DEBUG:`, {
          fuelLevel,
          fuelLevelPct,
          tankCapacity: fuelTankCapacity,
          calculatedFromPct:
            fuelLevelPct && fuelLevelPct > 0 ? fuelLevel / fuelLevelPct : 'N/A',
          fuelTankCapacityFromSession,
          sessionLapsRemain,
          sessionTimeRemain,
          avgLapTime,
          lapsRemaining: lapsRemaining,
          calculatedProjection: projectedLapUsage,
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
    const sessionType = projection?.sessionType;

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
    // lapHistorySize is an intentional cache-invalidation dep: lapHistory is read via
    // getState() for performance, and lapHistorySize is the reactive signal that
    // invalidates this memo whenever laps are added or removed from the store.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [
    sessionNum,
    fuelLevel,
    fuelLevelPct,
    lap,
    sessionLapsRemain,
    sessionLaps,
    sessionTimeRemain,
    sessionTimeTotal,
    sessionFlags,
    safetyMargin,
    lapStartFuel,
    settings,
    qualifyConsumption,
    fuelTankCapacityFromSession,
    lapDistPct,
    calculatedTotalRaceLaps,
    estimatedLapsRemaining,
    hasValidRaceEstimate,
    lapHistorySize,
    projection,
  ]);

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
        lapDistPctResetDetected: projection?.engine.isLapDistPctReset ?? false,
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
      projection,
      calculation,
    ]
  );

  useFuelLogger(isRace && isOnTrack ? debugData : null, settings);

  return calculation;
}
