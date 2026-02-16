import { useTelemetryValue } from '@irdashies/context';
import { FuelCalculatorSettings } from '../types';

const INTRINSIC_MARGIN_VALUE = 0.25;

interface UseFuelStrategyProps {
  lapsRemaining: number;
  lapsRemainingRefuel: number;
  lapsWithFuel: number;
  fuelLevel: number;
  trendAdjustedConsumption: number;
  validLapsCount: number;
  lap: number;
  tankCapacity: number;
  fuelStatusRedLaps?: number;
  settings?: FuelCalculatorSettings;
}

export function useFuelStrategy({
  lapsRemaining,
  lapsRemainingRefuel,
  lapsWithFuel,
  fuelLevel,
  trendAdjustedConsumption,
  validLapsCount,
  lap,
  tankCapacity,
  settings,
}: UseFuelStrategyProps) {
  const pitSvFlags = useTelemetryValue('PitSvFlags');
  const pitSvFuel = useTelemetryValue('PitSvFuel');

  // Enhanced confidence calculation
  const calculateConfidence = () => {
    if (validLapsCount >= 8) return 'high';
    if (validLapsCount >= 4) return 'medium';
    if (validLapsCount >= 2) return 'low';
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

  const safetyMargin = settings?.safetyMargin ?? 0.3;

  // Calculate fuel needed with dynamic safety margin
  const marginAmount =
    settings?.fuelUnits === 'gal' ? safetyMargin * 3.78541 : safetyMargin;
  const intrinsicMargin =
    settings?.fuelUnits === 'gal'
      ? INTRINSIC_MARGIN_VALUE * 3.78541
      : INTRINSIC_MARGIN_VALUE;

  const adjustedMargin =
    (marginAmount + intrinsicMargin) * confidenceMultiplier;

  // CRITICAL: Use lapsRemainingRefuel (Optimistic) for fuel calculation
  const fuelNeeded =
    lapsRemainingRefuel * trendAdjustedConsumption + adjustedMargin;
  const canFinish = fuelLevel >= fuelNeeded;

  // Calculate pit window
  const pitWindowOpen = lap + 1;
  const pitWindowClose = Math.max(
    pitWindowOpen,
    lap + Math.floor(lapsWithFuel * 0.8)
  );

  // Target consumption for fuel saving
  const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

  // Pit Service Awareness
  // Bit 4 (16) indicates fuel service request? I need to verify this bitmask.
  // Standard iRacing: 0x10 = refueling.
  const isFuelServiceRequested =
    pitSvFlags !== undefined && (pitSvFlags & 0x10) !== 0;
  const queuedFuel =
    isFuelServiceRequested && pitSvFuel !== undefined ? pitSvFuel : 0;

  // Calculate fuel at finish
  // If we have queued fuel, we assume it will be added.
  // BUT: logic from reference says "if extraAvg >= -2 then fuelOnPit = 0".
  // This implies if we are finishing comfortably, don't count pit fuel?
  // Or rather, if we are close to finishing, maybe the queue is irrelevant or stale?
  // Let's stick to: Fuel At Finish = (Current + Queued) - Needed.

  const fuelAtFinish =
    fuelLevel + queuedFuel - lapsRemaining * trendAdjustedConsumption;

  // Calculate stops remaining
  let stopsRemaining: number | undefined;
  let lapsPerStint: number | undefined;

  if (tankCapacity > 0 && trendAdjustedConsumption > 0) {
    lapsPerStint = tankCapacity / trendAdjustedConsumption;
  }

  if (
    lapsRemaining > 0 &&
    tankCapacity > 0 &&
    trendAdjustedConsumption > 0 &&
    fuelLevel >= 0
  ) {
    if (fuelLevel >= fuelNeeded) {
      stopsRemaining = 0;
    } else {
      const fuelDeficit = fuelNeeded - fuelLevel;
      stopsRemaining = Math.ceil(fuelDeficit / tankCapacity);
    }
  }

  // Calculate fuel to add
  let fuelToAdd = 0;
  if (stopsRemaining !== undefined && stopsRemaining > 1) {
    // Fill to capacity
    fuelToAdd = Math.max(0, tankCapacity - fuelLevel);
  } else {
    // 0 or 1 stop: Add exactly what is needed
    // If queuedFuel is present, should we subtract it?
    // "Fuel To Add" usually means "Recommended add".
    // If I already queued 50L, and I need 50L, the recommendation is 50L.
    // The UI might show "Queued: 50L" separately.
    fuelToAdd = Math.max(0, fuelNeeded - fuelLevel);
  }

  // Calculate earliest pit lap (Strategy)
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

  return {
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
    queuedFuel, // Expose this for UI
  };
}
