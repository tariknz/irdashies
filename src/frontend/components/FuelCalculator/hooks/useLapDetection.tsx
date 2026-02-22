import { useEffect, useRef, useState } from 'react';
import { useFuelStore } from '../FuelStore';
import { FuelLapData, FuelCalculatorSettings } from '../types';
import {
  validateLapData,
  detectLapCrossing,
  isGreenFlag,
  isCheckeredFlag,
} from '../fuelCalculations';

const MIN_LAP_TIME = 10;
const LAP_DIST_RESET_THRESHOLD = 0.5;

interface UseLapDetectionProps {
  lap: number | undefined;
  lapDistPct: number | undefined;
  sessionTime: number | undefined;
  sessionFlags: number | undefined;
  onPitRoad: boolean | undefined;
  fuelLevel: number | undefined;
  playerCarTowTime: number | undefined;
  sessionNum: number | undefined;
  sessionState: number | undefined;
  sessionTimeRemain: number | undefined;
  settings?: FuelCalculatorSettings;
}

export function useLapDetection({
  lap,
  lapDistPct,
  sessionTime,
  sessionFlags,
  onPitRoad,
  fuelLevel,
  playerCarTowTime,
  sessionNum,
  sessionState,
  sessionTimeRemain,
  settings,
}: UseLapDetectionProps) {
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const updateLapDistPct = useFuelStore((state) => state.updateLapDistPct);
  const addLapData = useFuelStore((state) => state.addLapData);
  const storedTrackId = useFuelStore((state) => state.trackId);
  const storedCarName = useFuelStore((state) => state.carName);

  const lastSessionTimeRef = useRef<number | undefined>(undefined);
  const lastRefuelTimeRef = useRef<number | undefined>(undefined);
  const prevFuelLevelRef = useRef<number | undefined>(undefined);
  const wasTowedDuringLapRef = useRef(false);
  const wasOnPitRoadDuringLapRef = useRef(false);
  const isLapFullyGreenRef = useRef(true);

  const [prevLapDistPct, setPrevLapDistPct] = useState<number | undefined>(
    undefined
  );
  const [isLapDistPctReset, setIsLapDistPctReset] = useState(false);

  const [isRaceFinished, setIsRaceFinished] = useState(false);
  const [checkFlagLap, setCheckFlagLap] = useState<number | null>(null);

  if (lapDistPct !== prevLapDistPct) {
    setPrevLapDistPct(lapDistPct);

    if (lapDistPct !== undefined && prevLapDistPct !== undefined) {
      if (lapDistPct < prevLapDistPct - LAP_DIST_RESET_THRESHOLD) {
        if (!isLapDistPctReset) setIsLapDistPctReset(true);
      } else if (isLapDistPctReset) {
        if (lapDistPct > prevLapDistPct + 0.05) {
          setIsLapDistPctReset(false);
        }
      }
    }
  }

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

  // Monitor tow time
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

  useEffect(() => {
    if (sessionFlags !== undefined) {
      if (!isGreenFlag(sessionFlags)) {
        isLapFullyGreenRef.current = false;
      }
    }
  }, [sessionFlags]);

  if (
    sessionFlags !== undefined &&
    lap !== undefined &&
    lapDistPct !== undefined
  ) {
    const isCheckered = isCheckeredFlag(sessionFlags);
    const isPostRaceState = sessionState !== undefined && sessionState >= 5;

    if (isCheckered || isPostRaceState) {
      if (checkFlagLap === null) {
        setCheckFlagLap(lap);

        const isLongCooldown =
          sessionTimeRemain !== undefined &&
          sessionTimeRemain > 300 &&
          isPostRaceState;

        if (lapDistPct < 0.05 || isLongCooldown) {
          if (!isRaceFinished) setIsRaceFinished(true);
        }
      } else {
        if (lap > checkFlagLap) {
          if (!isRaceFinished) setIsRaceFinished(true);
        }
      }
    } else {
      if (checkFlagLap !== null) {
        setCheckFlagLap(null);
        setIsRaceFinished(false);
      }
    }
  }

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

    if (prevFuelLevelRef.current !== undefined) {
      const fuelDelta = fuelLevel - prevFuelLevelRef.current;
      const timeDelta = sessionTime - (lastRefuelTimeRef.current || 0);

      if (fuelDelta > 0.05 && timeDelta > 5) {
        useFuelStore.getState().addRefuel(fuelDelta);
        lastRefuelTimeRef.current = sessionTime;
      }
    }
    prevFuelLevelRef.current = fuelLevel;

    const distCrossing = detectLapCrossing(lapDistPct, state.lastLapDistPct);
    const lapIncremented = lap > state.lastLap;

    if (lap < state.lastLap) {
      if (
        lastSessionTimeRef.current !== undefined &&
        sessionTime > lastSessionTimeRef.current
      ) {
        updateLapDistPct(lapDistPct);
        lastSessionTimeRef.current = sessionTime;
        return;
      }

      // Real reset
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap, onPitRoad);

      lastSessionTimeRef.current = sessionTime;
      // Note: We don't manually reset derived logic here as the props changing will likely handle it,
      // or the next render cycle will clean it up.
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
        updateLapDistPct(lapDistPct);
        return;
      }

      const completedLap = lap - 1;
      const fuelUsed = state.lapStartFuel + state.accumulatedRefuel - fuelLevel;
      const lapTime = timeSinceLastCrossing;

      if (completedLap >= 1 && fuelUsed > 0 && lapTime >= MIN_LAP_TIME) {
        const recentLaps = state.getRecentLaps(10);
        const isGreen = isLapFullyGreenRef.current;
        const isOutlier = !validateLapData(fuelUsed, lapTime, recentLaps);
        const wasTowed = wasTowedDuringLapRef.current;

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

        addLapData(lapData);

        if (
          storedTrackId !== undefined &&
          storedCarName !== undefined &&
          (settings?.enableStorage ?? true)
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).fuelCalculatorBridge.saveLap(
            storedTrackId,
            storedCarName,
            lapData
          );
        }
      }

      // Reset flags for new lap
      wasTowedDuringLapRef.current = false;
      wasOnPitRoadDuringLapRef.current = false;
      isLapFullyGreenRef.current = isGreenFlag(sessionFlags);

      const nextLap = Math.max(lap, completedLap + 1);

      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, nextLap, onPitRoad);
    } else if (state.lastLapDistPct === 0) {
      updateLapCrossing(lapDistPct, fuelLevel, sessionTime, lap, onPitRoad);
    } else {
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
    settings?.enableStorage,
  ]);

  return {
    isLapDistPctReset,
    isRaceFinished,
    checkFlagLap,
  };
}
