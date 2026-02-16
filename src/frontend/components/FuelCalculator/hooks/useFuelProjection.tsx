import { useRef, useState, useEffect } from 'react';

const MAX_PROJECTION_CHANGE_PERCENT = 0.5; // 50%

interface UseFuelProjectionProps {
  lap: number | undefined;
  lapDistPct: number | undefined;
  fuelLevel: number | undefined;
  lapStartFuel: number;
  lastLapUsage: number;
  avgConsumption: number;
  qualifyConsumption: number | null;
  isLapDistPctReset: boolean;
}

export function useFuelProjection({
  lap,
  lapDistPct,
  fuelLevel,
  lapStartFuel,
  lastLapUsage,
  avgConsumption,
  qualifyConsumption,
  isLapDistPctReset,
}: UseFuelProjectionProps) {
  // State for the final output
  const [projectedLapUsage, setProjectedLapUsage] = useState<number>(0);

  // Refs for history tracking (safe to read/write in useEffect)
  const historyRef = useRef({
    smoothedUsage: 0,
    lastLap: 0,
    lastProjected: 0 as number | null,
  });

  const currentLapUsage =
    lapStartFuel > 0 && fuelLevel !== undefined
      ? Math.max(0, lapStartFuel - fuelLevel)
      : 0;

  // Calculate projected usage in effect to avoid render side-effects with Refs
  useEffect(() => {
    const history = historyRef.current;

    // Capture values in effect scope
    const currentFuel = fuelLevel || 0;
    const _lapStartFuel = lapStartFuel;
    const _lastLapUsage = lastLapUsage;
    const _avgConsumption = avgConsumption || 0;
    const _qualifyConsumption = qualifyConsumption;
    const _lapDistPct = lapDistPct || 0;

    // ----------------------------------------
    // 1. Reset Detection
    // ----------------------------------------
    if (history.lastLap !== lap || isLapDistPctReset) {
      history.smoothedUsage = 0;
      history.lastLap = lap || 0;
      history.lastProjected = null; // Reset definitive projection history
    }

    // ----------------------------------------
    // 2. Definitive Calculation
    // ----------------------------------------
    let definitiveProjection = 0;

    // Current usage calc for projection
    const _currentUsage =
      _lapStartFuel > 0 && currentFuel !== undefined
        ? Math.max(0, _lapStartFuel - currentFuel)
        : 0;

    // Use appropriate historical reference
    let historicalReference = _avgConsumption;

    if (
      _lastLapUsage > 0 &&
      _avgConsumption > 0 &&
      Math.abs(_lastLapUsage - _avgConsumption) / _avgConsumption < 0.2
    ) {
      historicalReference = _lastLapUsage;
    } else if (historicalReference === 0 && _qualifyConsumption) {
      historicalReference = _qualifyConsumption;
    }

    if (historicalReference <= 0) historicalReference = 3.2;

    // Logic: If refuel or invalid dist, use historical
    if (
      currentFuel > _lapStartFuel ||
      isLapDistPctReset ||
      _lapDistPct > 0.99 ||
      _lapDistPct < 0.001
    ) {
      definitiveProjection = historicalReference;
    } else {
      const rawProjection = _currentUsage / _lapDistPct;
      const minReasonable = 0.1;
      const maxReasonable = 20.0;
      const safeProjection = Math.max(
        minReasonable,
        Math.min(maxReasonable, rawProjection)
      );

      // Confidence mixing
      let confidence = 0;
      if (_lapDistPct < 0.5) {
        confidence = (_lapDistPct / 0.5) * 0.5;
      } else {
        confidence = 0.5 + ((_lapDistPct - 0.5) / 0.5) * 0.3;
      }

      let projected =
        safeProjection * confidence + historicalReference * (1 - confidence);
      const safetyMultiplier = 1.02 + 0.05 * (1 - confidence);
      projected = projected * safetyMultiplier;

      // Limit drastic variation (using historyRef)
      if (history.lastProjected !== null && history.lastProjected > 0) {
        const maxChange = history.lastProjected * MAX_PROJECTION_CHANGE_PERCENT;
        const minAllowed = history.lastProjected - maxChange;
        const maxAllowed = history.lastProjected + maxChange;
        projected = Math.max(minAllowed, Math.min(maxAllowed, projected));
      }

      definitiveProjection = projected;
    }

    // Store for next frame
    history.lastProjected = definitiveProjection;

    // ----------------------------------------
    // 3. Smoothing
    // ----------------------------------------
    const baseSmoothingFactor = 0.1;
    let progressBasedFactor = Math.min(
      0.3,
      baseSmoothingFactor * (1 + _lapDistPct * 2)
    );
    if (_lapDistPct > 0.9) {
      progressBasedFactor = 0.05;
    }

    if (history.smoothedUsage === 0) {
      history.smoothedUsage = definitiveProjection;
    } else {
      const maxChange = 0.2;
      let targetValue = definitiveProjection;
      const potentialChange = targetValue - history.smoothedUsage;

      if (Math.abs(potentialChange) > maxChange) {
        targetValue =
          history.smoothedUsage + Math.sign(potentialChange) * maxChange;
      }

      history.smoothedUsage =
        history.smoothedUsage +
        (targetValue - history.smoothedUsage) * progressBasedFactor;
    }

    setProjectedLapUsage(history.smoothedUsage);
  }, [
    lap,
    lapDistPct,
    fuelLevel,
    lapStartFuel,
    lastLapUsage,
    avgConsumption,
    qualifyConsumption,
    isLapDistPctReset,
  ]);

  return {
    projectedLapUsage,
    currentLapUsage,
  };
}
