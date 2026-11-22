import type { FuelCalculation, FuelLapData } from './types';

const DEMO_FUEL_USAGE = [
  2.28, 2.48, 2.3, 2.28, 2.36, 2.4, 2.28, 2.3, 2.32, 2.4,
];
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** Newest first, matching the history table. No sample enters the live store. */
export const demoFuelHistory = (
  count: number,
  sessionNum: number,
  elapsedSec = 0
): FuelLapData[] => {
  const completed = Math.floor(elapsedSec / 8);
  return Array.from({ length: count }, (_, index) => {
    const lapNumber = Math.max(1, completed + count - index);
    const usageIndex =
      (DEMO_FUEL_USAGE.length -
        1 -
        (index % DEMO_FUEL_USAGE.length) +
        completed) %
      DEMO_FUEL_USAGE.length;
    const wobble = Math.sin(elapsedSec * 0.4 + index) * 0.04;
    return {
      lapNumber,
      sessionNum,
      timestamp: lapNumber * 90000 + Math.floor(elapsedSec * 1000),
      fuelUsed: Number((DEMO_FUEL_USAGE[usageIndex] + wobble).toFixed(2)),
      lapTime: 90,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      isHistorical: true,
    };
  });
};

const staticLaps = demoFuelHistory(30, -1, 0).reverse();
const staticFuelValues = staticLaps.map((lap) => lap.fuelUsed);
export const demoFuelGraph = {
  laps: staticLaps,
  fuelValues: staticFuelValues,
  avgFuel: average(staticFuelValues),
  minFuel: Math.min(...staticFuelValues),
  maxFuel: Math.max(...staticFuelValues),
};

export const getDemoFuelGraph = (elapsedSec = 0, lapCount = 15) => {
  const newestFirst = demoFuelHistory(lapCount, -1, elapsedSec);
  const laps = [...newestFirst].reverse();
  const fuelValues = laps.map((lap) => lap.fuelUsed);
  return {
    laps,
    fuelValues,
    avgFuel: average(fuelValues),
    minFuel: Math.min(...fuelValues),
    maxFuel: Math.max(...fuelValues),
  };
};

const DEMO_FUEL_BASE: FuelCalculation = {
  fuelLevel: 32.6,
  lastLapUsage: staticFuelValues[staticFuelValues.length - 1],
  currentLapUsage: 1.3,
  projectedLapUsage: 2.35,
  avgLaps: average(staticFuelValues.slice(-5)),
  avg10Laps: average(staticFuelValues.slice(-10)),
  avgAllGreenLaps: demoFuelGraph.avgFuel,
  minLapUsage: demoFuelGraph.minFuel,
  maxLapUsage: demoFuelGraph.maxFuel,
  lapsWithFuel: 13.9,
  lapsRemaining: 32,
  totalLaps: 35,
  currentLap: 3,
  fuelToFinish: 74.9,
  fuelToAdd: 42.3,
  pitWindowOpen: 15,
  pitWindowClose: 16.9,
  canFinish: false,
  targetConsumption: 1.02,
  confidence: 'high',
  fuelAtFinish: -42.3,
  avgLapTime: 90,
  stopsRemaining: 1,
  lapsPerStint: 25.6,
  targetScenarios: [
    { laps: 11, fuelPerLap: 2.34, isCurrentTarget: false },
    { laps: 12, fuelPerLap: 2.34, isCurrentTarget: true },
    { laps: 13, fuelPerLap: 2.34, isCurrentTarget: false },
  ],
  earliestPitLap: 15,
  fuelTankCapacity: 60,
  lastFinishedLap: 2,
  fuelStatus: 'safe',
  lapsRange: [31, 34],
  maxQualify: null,
};

/** Static snapshot for stories / specs. */
export const demoFuelData: FuelCalculation = DEMO_FUEL_BASE;

/** Fuel burns and lap advances over a ~90s stint loop. */
export const getDemoFuelData = (elapsedSec = 0): FuelCalculation => {
  const lapSec = 90;
  const fuelPerLap = 2.35;
  const startFuel = 45;
  const startLap = 3;
  const lapsDone = Math.floor(elapsedSec / lapSec);
  const lapFrac = (elapsedSec % lapSec) / lapSec;
  const fuelLevel = Math.max(
    0,
    startFuel - lapsDone * fuelPerLap - lapFrac * fuelPerLap
  );
  const currentLap = startLap + lapsDone;
  const lapsWithFuel = fuelLevel / fuelPerLap;
  const lapsRemaining = Math.max(0, 35 - currentLap);
  const fuelToFinish = lapsRemaining * fuelPerLap;
  const fuelToAdd = Math.max(0, fuelToFinish - fuelLevel);
  const canFinish = fuelLevel >= fuelToFinish;
  const fuelStatus =
    lapsWithFuel < lapsRemaining - 1
      ? 'danger'
      : lapsWithFuel < lapsRemaining + 1
        ? 'caution'
        : 'safe';

  return {
    ...DEMO_FUEL_BASE,
    fuelLevel: Number(fuelLevel.toFixed(1)),
    currentLapUsage: Number((lapFrac * fuelPerLap).toFixed(2)),
    currentLap,
    lastFinishedLap: Math.max(0, currentLap - 1),
    lapsWithFuel: Number(lapsWithFuel.toFixed(1)),
    lapsRemaining,
    fuelToFinish: Number(fuelToFinish.toFixed(1)),
    fuelToAdd: Number(fuelToAdd.toFixed(1)),
    fuelAtFinish: Number((fuelLevel - fuelToFinish).toFixed(1)),
    canFinish,
    fuelStatus,
    pitWindowOpen: Math.max(0, currentLap + Math.floor(lapsWithFuel) - 2),
    pitWindowClose: Math.max(0, currentLap + Math.floor(lapsWithFuel)),
    stopsRemaining: canFinish ? 0 : 1,
  };
};
