/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Hook for calculating fuel metrics from telemetry data
 * Refactored to use focused hooks for better maintainability
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  useSessionLaps,
  useSessionStore,
  useTelemetryValue,
} from '@irdashies/context';
import { useStore } from 'zustand';
import {
  useFuelStore,
  selectLapHistorySize,
  selectLastLapUsage,
} from './FuelStore';
import type { FuelCalculation, FuelCalculatorSettings } from './types';
import { useFuelLogger } from './useFuelLogger';

// Hooks
import { useLapDetection } from './hooks/useLapDetection';
import { useFuelProjection } from './hooks/useFuelProjection';
import { useRemainingLaps } from './hooks/useRemainingLaps';
import { useFuelStrategy } from './hooks/useFuelStrategy';
import { useFuelAlerts } from './hooks/useFuelAlerts';
import { useFuelStats } from './hooks/useFuelStats';

export function useFuelCalculation(
  safetyMargin = 0.3,
  settings?: FuelCalculatorSettings
): FuelCalculation | null {
  // --------------------------------------------------------------------------
  // 1. Telemetry & Store Access
  // --------------------------------------------------------------------------
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
  const playerCarTowTime = useTelemetryValue('PlayerCarTowTime');

  // Driver Info
  const driverCarFuelMaxLtr = useStore(
    useSessionStore,
    (state) => state.session?.DriverInfo?.DriverCarFuelMaxLtr
  );
  const driverCarMaxFuelPct = useStore(
    useSessionStore,
    (state) => state.session?.DriverInfo?.DriverCarMaxFuelPct
  );

  const fuelTankCapacityFromSession =
    driverCarFuelMaxLtr !== undefined && driverCarMaxFuelPct !== undefined
      ? driverCarFuelMaxLtr * driverCarMaxFuelPct
      : driverCarFuelMaxLtr;

  // Track & Car Info
  const rawTrackId = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackID
  );
  const trackName = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackName
  );
  const trackId = trackName ?? rawTrackId;

  // Store Actions & State
  const updateSessionInfo = useFuelStore((state) => state.updateSessionInfo);
  const clearAllData = useFuelStore((state) => state.clearAllData);
  const setContextInfo = useFuelStore((state) => state.setContextInfo);
  const setQualifyConsumption = useFuelStore(
    (state) => state.setQualifyConsumption
  );

  const storedTrackId = useFuelStore((state) => state.trackId);
  const storedCarName = useFuelStore((state) => state.carName);
  const qualifyConsumption = useFuelStore((state) => state.qualifyConsumption);
  const lapStartFuel = useFuelStore((state) => state.lapStartFuel);

  // Reactivity Subscriptions
  const lapHistorySize = useFuelStore(selectLapHistorySize);
  const storeLastLapUsage = useFuelStore(selectLastLapUsage);

  // --------------------------------------------------------------------------
  // 2. Context Management (Session/Car Change)
  // --------------------------------------------------------------------------

  const loadedContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionNum !== undefined) {
      updateSessionInfo(sessionNum);
    }
  }, [sessionNum, updateSessionInfo]);

  // Log Rotation
  const prevIsOnTrackRef = useRef(isOnTrack);
  useEffect(() => {
    const enteredCar = isOnTrack && !prevIsOnTrackRef.current;
    if (enteredCar && settings?.enableLogging) {
      window.fuelCalculatorBridge.startNewLog().catch(console.error);
    }
    prevIsOnTrackRef.current = isOnTrack;
  }, [isOnTrack, settings?.enableLogging]);

  // Context Loading (Track/Car change)
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

    const contextChanged =
      currentContext !== null && currentContext !== loadedContextRef.current;

    if (contextChanged) {
      loadedContextRef.current = currentContext;
      clearAllData();
      setQualifyConsumption(null);

      if (settings?.enableStorage ?? true) {
        const [tId, cName] = currentContext.split(':');
        window.fuelCalculatorBridge
          .getHistoricalLaps(tId, cName)
          .then((laps) => {
            useFuelStore.getState().setLapHistory(laps);
          });

        window.fuelCalculatorBridge.getQualifyMax(tId, cName).then((val) => {
          if (val !== null) setQualifyConsumption(val);
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

  // Qualify Consumption Tracking
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

  // --------------------------------------------------------------------------
  // 3. Lap Detection
  // --------------------------------------------------------------------------

  const { isLapDistPctReset, isRaceFinished } = useLapDetection({
    lap,
    lapDistPct,
    sessionTime,
    sessionFlags,
    onPitRoad: onPitRoad === 1,
    fuelLevel,

    playerCarTowTime,
    sessionNum,
    sessionState,
    sessionTimeRemain,
    settings,
  });

  // --------------------------------------------------------------------------

  // Get current lap usage for stats & projection
  const currentLapUsage =
    lapStartFuel > 0 && fuelLevel !== undefined
      ? Math.max(0, lapStartFuel - fuelLevel)
      : 0;

  // Compute Stats
  const lapHistory = useFuelStore.getState().getLapHistory();

  const stats = useFuelStats({
    lapHistory,
    fuelLevel,
    fuelLevelPct,
    fuelTankCapacityFromSession,
    currentLapUsage,
    lapDistPct,
    storeLastLapUsage,
    qualifyConsumption,
    settings,
  });

  // Calculate Remaining Laps logic
  // We need defaults if stats are null
  const avgLapTime = stats ? stats.avgLapTime : 0;
  const trendAdjustedConsumption = stats ? stats.trendAdjustedConsumption : 0;

  const { lapsRemaining, lapsRemainingRefuel, totalLaps } = useRemainingLaps({
    sessionLapsRemain,
    sessionTimeRemain,
    lap,
    lapDistPct,
    avgLapTime,
    trendAdjustedConsumption,
    fuelLevel,
    sessionFlags,
    sessionLaps,
  });

  // Calculate Projection
  const { projectedLapUsage } = useFuelProjection({
    lap,
    lapDistPct,
    fuelLevel,
    lapStartFuel,
    lastLapUsage: stats ? stats.lastLapUsage : 0,
    avgConsumption: stats ? stats.avgFuelPerLapBase : 0,
    qualifyConsumption,
    isLapDistPctReset,
  });

  // Calculate Strategy (Pit & Fuel Needed)
  const {
    fuelNeeded,
    fuelToAdd,
    canFinish,
    stopsRemaining,
    lapsPerStint,
    earliestPitLap,
    pitWindowOpen,
    pitWindowClose,
    targetConsumption,
    confidence,
    fuelAtFinish,
    queuedFuel,
  } = useFuelStrategy({
    lapsRemaining,
    lapsRemainingRefuel,
    lapsWithFuel: stats ? stats.lapsWithFuel : 0,
    fuelLevel: fuelLevel ?? 0,
    trendAdjustedConsumption,
    validLapsCount: stats ? stats.validLapsCount : 0,
    lap: lap || 0,
    tankCapacity: stats ? stats.fuelTankCapacity : 60,
    settings,
  });

  // Calculate Alerts
  const { fuelStatus, gridWarning } = useFuelAlerts({
    fuelLevelPct,
    sessionNum,
    fuelLevel,
    trendAdjustedConsumption,
    maxLapUsage: stats ? stats.maxLapUsage : 0,
    minLapUsage: stats ? stats.minLapUsage : 0,
    lastLapUsage: stats ? stats.lastLapUsage : 0,
    lapsRemaining,
    sessionState,
    tankCapacity: stats ? stats.fuelTankCapacity : 60,
    fuelNeeded,
    settings,
  });

  // --------------------------------------------------------------------------
  // 5. Final Object Construction
  // --------------------------------------------------------------------------

  // We wrap in useMemo to stabilize reference for consumers
  const calculation = useMemo((): FuelCalculation | null => {
    // If critical data missing, return null or safe empty
    if (
      fuelLevel === undefined ||
      fuelLevelPct === undefined ||
      lap === undefined ||
      sessionLapsRemain === undefined
    ) {
      return null;
    }

    if (!stats) return null; // No history/valid laps

    // Target Scenarios
    const targetScenarios: FuelCalculation['targetScenarios'] = [];
    if (stats.lapsWithFuel >= 0.5) {
      const currentLapTarget = Math.floor(stats.lapsWithFuel);
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

    const result: FuelCalculation = {
      fuelLevel,
      lastLapUsage: stats.lastLapUsage,
      currentLapUsage,
      projectedLapUsage,
      avgLaps: stats.avgLaps,
      avg10Laps: stats.avg10Laps,
      avgAllGreenLaps: stats.avgAllGreenLaps,
      minLapUsage: stats.minLapUsage,
      maxLapUsage: stats.maxLapUsage,
      maxQualify: qualifyConsumption,
      lapsWithFuel: stats.lapsWithFuel,
      lapsRemaining,
      totalLaps,
      currentLap: lap,
      fuelToFinish: fuelNeeded,
      fuelToAdd,
      pitWindowOpen,
      pitWindowClose,
      canFinish,
      targetConsumption,
      confidence: confidence as 'high' | 'medium' | 'low' | 'very-low',
      fuelAtFinish,
      avgLapTime,
      sessionTimeTotal: sessionTimeTotal ?? 0,
      stopsRemaining,
      lapsPerStint,
      targetScenarios,
      earliestPitLap,
      fuelTankCapacity: stats.fuelTankCapacity,
      lastFinishedLap:
        stats.lapsToUse.length > 0 ? stats.lapsToUse[0].lapNumber : undefined,
      fuelStatus,
      lapsRange: [
        Math.max(0, Math.floor(lapsRemaining * 0.9)),
        Math.ceil(lapsRemaining * 1.1) + 1,
      ],
      gridWarning,
      queuedFuel,
    };

    // Override if race finished
    if (isRaceFinished) {
      return {
        ...result,
        lapsRemaining: 0,
        fuelToFinish: 0,
        fuelToAdd: 0,
        canFinish: true,
        fuelStatus: 'safe',
        stopsRemaining: 0,
        confidence: 'high',
      };
    }

    return result;
  }, [
    fuelLevel,
    fuelLevelPct,
    lap,
    sessionLapsRemain,
    sessionTimeTotal,
    stats,
    lapsRemaining,
    totalLaps,
    projectedLapUsage,
    fuelNeeded,
    fuelToAdd,
    canFinish,
    stopsRemaining,
    lapsPerStint,
    earliestPitLap,
    pitWindowOpen,
    pitWindowClose,
    targetConsumption,
    confidence,
    fuelAtFinish,
    queuedFuel,
    fuelStatus,
    gridWarning,
    isRaceFinished,
    qualifyConsumption,
    currentLapUsage,
    avgLapTime,
  ]);

  // LOGGING
  const debugData = useMemo(
    () => ({
      inputs: {
        fuelLevel,
        lap,
        // ... abbreviated inputs
      },
      calculation,
    }),
    [fuelLevel, lap, calculation]
  );

  const isRaceForLogging =
    sessionNum !== undefined &&
    useSessionStore.getState().session?.SessionInfo?.Sessions?.[sessionNum]
      ?.SessionType === 'Race';

  useFuelLogger(isRaceForLogging && isOnTrack ? debugData : null, settings);

  return calculation;
}
