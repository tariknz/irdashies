import { FuelCalculatorSettings } from '../types';

interface CalculateFuelAlertsProps {
  fuelLevelPct: number | undefined;
  sessionType: string | undefined;
  fuelLevel: number | undefined;
  trendAdjustedConsumption: number;
  maxLapUsage: number;
  minLapUsage: number;
  lastLapUsage: number;
  lapsRemaining: number;
  sessionState: number | undefined;
  tankCapacity: number;
  fuelNeeded: number;
  settings?: FuelCalculatorSettings;
}

export type GridWarningType =
  | 'fill_tank'
  | 'low_fuel'
  | 'can_finish_fill'
  | null;

export function calculateFuelAlerts({
  fuelLevelPct,
  sessionType,
  fuelLevel,
  trendAdjustedConsumption,
  maxLapUsage,
  minLapUsage,
  lastLapUsage,
  lapsRemaining,
  sessionState,
  tankCapacity,
  fuelNeeded,
  settings,
}: CalculateFuelAlertsProps) {
  const statusThresholds = settings?.fuelStatusThresholds || {
    green: 60,
    amber: 30,
    red: 10,
  };
  const statusBasis = settings?.fuelStatusBasis || 'avg';
  const redLapsThreshold = settings?.fuelStatusRedLaps ?? 3;

  let fuelStatus: 'safe' | 'caution' | 'danger' = 'safe';

  const currentFuelPctValue = (fuelLevelPct ?? 0) * 100;

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

  const basisUsageValue =
    statusBasis === 'max'
      ? maxLapUsage
      : statusBasis === 'min'
        ? minLapUsage
        : statusBasis === 'last'
          ? lastLapUsage
          : trendAdjustedConsumption;

  const lapsLeftOnBasis =
    basisUsageValue > 0 && fuelLevel !== undefined
      ? fuelLevel / basisUsageValue
      : 0;

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

  let gridWarning: GridWarningType = null;

  const isPreRace =
    sessionState !== undefined && sessionState < 4 && !isQualifyingOrPractice;

  if (
    isPreRace &&
    fuelLevel !== undefined &&
    tankCapacity > 0 &&
    trendAdjustedConsumption > 0
  ) {
    const lapsInTank = fuelLevel / trendAdjustedConsumption;
    const fullTankLaps = tankCapacity / trendAdjustedConsumption;

    if (tankCapacity >= fuelNeeded && fuelLevel < fuelNeeded) {
      gridWarning = 'can_finish_fill';
    } else if (fullTankLaps > 5 && lapsInTank < 5 && lapsRemaining > 5) {
      gridWarning = 'low_fuel';
    } else if (tankCapacity < fuelNeeded && fuelLevel < tankCapacity - 2) {
      gridWarning = 'fill_tank';
    }
  }

  return {
    fuelStatus,
    gridWarning,
    lapsLeftOnBasis,
  };
}
