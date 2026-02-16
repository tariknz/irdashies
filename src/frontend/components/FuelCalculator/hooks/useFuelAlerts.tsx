import { useSessionStore } from '@irdashies/context';
import { FuelCalculatorSettings } from '../types';

interface UseFuelAlertsProps {
  fuelLevelPct: number | undefined;
  sessionNum: number | undefined;
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

export function useFuelAlerts({
  fuelLevelPct,
  sessionNum,
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
}: UseFuelAlertsProps) {
  // --------------------------------------------------------------------------
  // Fuel Status (Safe/Caution/Danger)
  // --------------------------------------------------------------------------

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

  // Laps remaining override
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

  // --------------------------------------------------------------------------
  // Grid Fuel Warning
  // --------------------------------------------------------------------------

  let gridWarning: GridWarningType = null;

  // Check if in Grid/Warmup (State < 2 usually means Warmup/Grid, 2=StartHidden, 3=StartReady, 4=Racing)
  // Reference says "SessionState < 2". iRacing docs: 0=Invalid, 1=GetInCar, 2=Warmup, 3=Parade, 4=Racing, 5=Checkered, 6=CoolDown
  // Wait, Reference Check: "3 conditions checked when SessionState < 2 (pre-race)"
  // iRacing SessionState:
  // kSessionState_GetInCar = 1
  // kSessionState_Warmup = 2
  // kSessionState_ParadeLaps = 3
  // kSessionState_Racing = 4

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

    // Condition 1: Tank CAN hold full race, but is not full enough
    if (tankCapacity >= fuelNeeded && fuelLevel < fuelNeeded) {
      gridWarning = 'can_finish_fill';
    }
    // Condition 2: Tank holds > 5 laps but current fuel < 5 laps (and race is long enough)
    else if (fullTankLaps > 5 && lapsInTank < 5 && lapsRemaining > 5) {
      gridWarning = 'low_fuel';
    }
    // Condition 3: Tank too small for full race, but current fuel is not full ( < tank - 2L)
    else if (tankCapacity < fuelNeeded && fuelLevel < tankCapacity - 2) {
      gridWarning = 'fill_tank';
    }
  }

  return {
    fuelStatus,
    gridWarning,
    lapsLeftOnBasis,
  };
}
