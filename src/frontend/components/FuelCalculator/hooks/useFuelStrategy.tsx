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

  const calculateConfidence = () => {
    if (validLapsCount >= 8) return 'high';
    if (validLapsCount >= 4) return 'medium';
    if (validLapsCount >= 2) return 'low';
    return 'very-low';
  };

  const confidence = calculateConfidence();

  const confidenceMultiplier =
    {
      'very-low': 1.5,
      low: 1.3,
      medium: 1.15,
      high: 1.0,
    }[confidence] || 1.0;

  const safetyMargin = settings?.safetyMargin ?? 0.3;

  const marginAmount =
    settings?.fuelUnits === 'gal' ? safetyMargin * 3.78541 : safetyMargin;
  const intrinsicMargin =
    settings?.fuelUnits === 'gal'
      ? INTRINSIC_MARGIN_VALUE * 3.78541
      : INTRINSIC_MARGIN_VALUE;

  const adjustedMargin =
    (marginAmount + intrinsicMargin) * confidenceMultiplier;

  const fuelNeeded =
    lapsRemainingRefuel * trendAdjustedConsumption + adjustedMargin;
  const canFinish = fuelLevel >= fuelNeeded;

  const pitWindowOpen = lap + 1;
  const pitWindowClose = Math.max(
    pitWindowOpen,
    lap + Math.floor(lapsWithFuel * 0.8)
  );

  const targetConsumption = lapsRemaining > 0 ? fuelLevel / lapsRemaining : 0;

  const isFuelServiceRequested =
    pitSvFlags !== undefined && (pitSvFlags & 0x10) !== 0;
  const rawQueuedFuel =
    isFuelServiceRequested && pitSvFuel !== undefined ? pitSvFuel : 0;

  const rawDeficit = fuelNeeded - fuelLevel;
  const effectiveQueuedFuel = rawDeficit > 2 ? rawQueuedFuel : 0;
  const queuedFuel = effectiveQueuedFuel;

  const fuelAtFinish =
    fuelLevel + effectiveQueuedFuel - lapsRemaining * trendAdjustedConsumption;

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

  let fuelToAdd = 0;
  if (stopsRemaining !== undefined && stopsRemaining > 1) {
    fuelToAdd = Math.max(0, tankCapacity - fuelLevel);
  } else {
    fuelToAdd = Math.max(0, fuelNeeded - fuelLevel - effectiveQueuedFuel);
  }

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
    queuedFuel,
  };
}
