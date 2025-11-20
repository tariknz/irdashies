/**
 * Type definitions for Fuel Calculator
 */

/**
 * Data for a single lap's fuel consumption
 */
export interface FuelLapData {
  /** Lap number */
  lapNumber: number;
  /** Fuel consumed during this lap (liters) */
  fuelUsed: number;
  /** Lap time in seconds */
  lapTime: number;
  /** Whether this lap was under green flag conditions */
  isGreenFlag: boolean;
  /** Whether this lap is valid for calculations (outlier filtering) */
  isValidForCalc: boolean;
  /** Whether the car started this lap from pit road (out-lap) */
  isOutLap: boolean;
  /** Timestamp when lap was completed */
  timestamp: number;
}

/**
 * Complete fuel calculation result
 */
export interface FuelCalculation {
  /** Current fuel level (liters) */
  fuelLevel: number;
  /** Fuel used on the most recent completed lap (liters) */
  lastLapUsage: number;
  /** Average fuel consumption over last 3 laps (liters) */
  avg3Laps: number;
  /** Average fuel consumption over last 10 laps (liters) */
  avg10Laps: number;
  /** Average fuel consumption for all green flag laps (liters) */
  avgAllGreenLaps: number;
  /** Minimum fuel used in a single lap (liters) */
  minLapUsage: number;
  /** Maximum fuel used in a single lap (liters) */
  maxLapUsage: number;
  /** Estimated number of laps possible with current fuel */
  lapsWithFuel: number;
  /** Number of laps remaining in the session */
  lapsRemaining: number;
  /** Total laps in the session */
  totalLaps: number;
  /** Current lap number */
  currentLap: number;
  /** Total fuel needed to finish the race (liters) */
  fuelToFinish: number;
  /** Amount of fuel to add at next pit stop (liters) */
  fuelToAdd: number;
  /** Earliest lap to pit (current lap + 1) */
  pitWindowOpen: number;
  /** Latest lap to pit before running out of fuel */
  pitWindowClose: number;
  /** Whether current fuel is sufficient to finish */
  canFinish: boolean;
  /** Target fuel consumption per lap to finish with current fuel (liters) */
  targetConsumption: number;
  /** Confidence level in the calculations */
  confidence: 'high' | 'medium' | 'low';
  /** Estimated fuel remaining at race finish (can be negative if insufficient fuel) */
  fuelAtFinish: number;
  /** Average lap time in seconds (for time until empty calculation) */
  avgLapTime: number;
}

/**
 * Fuel calculator widget settings
 */
export interface FuelCalculatorSettings {
  /** Fuel units to display */
  fuelUnits: 'L' | 'gal';
  /** Layout style */
  layout?: 'vertical' | 'horizontal';
  /** Show detailed consumption breakdown */
  showConsumption: boolean;
  /** Show minimum fuel consumption */
  showMin: boolean;
  /** Show consumption for last lap */
  showLastLap: boolean;
  /** Show average over last 3 laps */
  show3LapAvg: boolean;
  /** Show average over last 10 laps */
  show10LapAvg: boolean;
  /** Show maximum fuel consumption */
  showMax: boolean;
  /** Show pit window information */
  showPitWindow: boolean;
  /** Show fuel save indicator */
  showFuelSave: boolean;
  /** Show fuel required for min/avg/max consumption */
  showFuelRequired?: boolean;
  /** Safety margin percentage (0-1) */
  safetyMargin: number;
  /** Background opacity (0-100) */
  background: { opacity: number };
}
