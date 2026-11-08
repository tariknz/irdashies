import type { FuelCalculation, FuelLapData } from './types';

const DEMO_FUEL_USAGE = [
  2.28, 2.48, 2.3, 2.28, 2.36, 2.4, 2.28, 2.3, 2.32, 2.4,
];
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** Newest first, matching the history table. No sample enters the live store. */
export const demoFuelHistory = (
  count: number,
  sessionNum: number
): FuelLapData[] =>
  Array.from({ length: count }, (_, index) => ({
    lapNumber: count - index,
    sessionNum,
    timestamp: (count - index) * 90000,
    fuelUsed:
      DEMO_FUEL_USAGE[
        DEMO_FUEL_USAGE.length - 1 - (index % DEMO_FUEL_USAGE.length)
      ],
    lapTime: 90,
    isGreenFlag: true,
    isValidForCalc: true,
    isOutLap: false,
    isHistorical: true,
  }));

const laps = demoFuelHistory(30, -1).reverse();
const fuelValues = laps.map((lap) => lap.fuelUsed);
export const demoFuelGraph = {
  laps,
  fuelValues,
  avgFuel: average(fuelValues),
  minFuel: Math.min(...fuelValues),
  maxFuel: Math.max(...fuelValues),
};

export const demoFuelData: FuelCalculation = {
  fuelLevel: 32.6,
  lastLapUsage: fuelValues[fuelValues.length - 1],
  currentLapUsage: 1.3,
  projectedLapUsage: 2.35,
  avgLaps: average(fuelValues.slice(-5)),
  avg10Laps: average(fuelValues.slice(-10)),
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
