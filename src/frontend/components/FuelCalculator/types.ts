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
}

/**
 * Fuel calculator widget settings
 */
export interface FuelCalculatorSettings {
  /** Fuel units to display */
  fuelUnits: 'L' | 'gal';
  /** Show detailed consumption breakdown */
  showConsumption: boolean;
  /** Show consumption for last lap */
  showLastLap: boolean;
  /** Show average over last 3 laps */
  show3LapAvg: boolean;
  /** Show average over last 10 laps */
  show10LapAvg: boolean;
  /** Show pit window information */
  showPitWindow: boolean;
  /** Show fuel save indicator */
  showFuelSave: boolean;
  /** Safety margin percentage (0-1) */
  safetyMargin: number;
  /** Background opacity (0-100) */
  background: { opacity: number };
}
