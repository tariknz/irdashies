/**
 * Type definitions for Fuel Calculator
 */
import type { SessionVisibilitySettings } from '../Settings/types';

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
  /** Whether the car was towed during this lap */
  wasTowed?: boolean;
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
  /** Fuel used so far in the current lap (liters) */
  currentLapUsage?: number;
  /** Projected fuel usage for the current lap (liters) */
  projectedLapUsage?: number;
  /** Average fuel consumption over customizable last N laps (liters) */
  avgLaps: number;
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
  /** Total session time in seconds (for endurance strategy) */
  sessionTimeTotal?: number;
  /** Estimated number of pit stops remaining in the session */
  stopsRemaining?: number;
  /** Estimated laps per fuel stint (on a full tank) */
  lapsPerStint?: number;
  /** Target scenarios for making current fuel last different lap counts */
  targetScenarios?: {
    laps: number; // Target lap count (e.g., 19, 20, 21)
    fuelPerLap: number; // Required L/lap to achieve this (e.g., 2.63)
    isCurrentTarget: boolean; // True for the middle/current value
  }[];
  /** Earliest lap to pit while still being able to finish (for safety car strategy) */
  earliestPitLap?: number;
  /** Fuel tank capacity in liters (respecting session limits) */
  fuelTankCapacity?: number;
  /** The lap number of the last finished lap included in the calculation */
  lastFinishedLap?: number;
  /** Fuel safety status based on current level vs required */
  fuelStatus?: 'safe' | 'caution' | 'danger';
  /** Minimum and maximum number of laps estimated in the session at the current pace */
  lapsRange?: [number, number];
}

/**
 * Fuel calculator widget settings
 */
export interface FuelCalculatorSettings {
  showOnlyWhenOnTrack: boolean;
  /** Fuel units to display */
  fuelUnits: 'L' | 'gal';
  /** Layout style */
  layout?: 'vertical' | 'horizontal';
  /** Show detailed consumption breakdown */
  showConsumption: boolean;
  /** Show fuel level */
  showFuelLevel: boolean;
  /** Show laps remaining */
  showLapsRemaining: boolean;
  /** Show minimum fuel consumption */
  showMin: boolean;
  /** Show live current lap consumption */
  showCurrentLap: boolean;
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
  /** Show endurance strategy (total pit stops for entire session) */
  showEnduranceStrategy?: boolean;
  /** Show fuel scenarios (target consumption for different lap counts) */
  showFuelScenarios: boolean;
  /** Show fuel required for min/avg/max consumption */
  showFuelRequired?: boolean;
  /** Show fuel history graph */
  showFuelHistory?: boolean;
  /** Fuel history graph type */
  fuelHistoryType?: 'line' | 'histogram';
  /** Safety margin percentage (0-1) */
  safetyMargin: number;
  manualTarget?: number;
  /** Background opacity (0-100) */
  background: { opacity: number };
  /** Display mode for fuel required column: 'toFinish' shows total fuel needed, 'toAdd' shows fuel to add at stop */
  fuelRequiredMode?: 'toFinish' | 'toAdd';
  enableTargetPitLap?: boolean;
  targetPitLap?: number;
  /** Number of laps to use for AVG calculation (default: 3) */
  avgLapsCount?: number;
  useGeneralFontSize?: boolean;
  useGeneralCompactMode?: boolean;

  sessionVisibility: SessionVisibilitySettings;
  /** 
   * Box Layout Configuration 
   * Defines the structure of boxes and which widgets they contain
   */
  layoutConfig?: BoxConfig[];
  /** Recursive Layout Tree (Supersedes layoutConfig) */
  layoutTree?: any; // Using any for now to match actual usage in FuelCalculator.tsx, but should be LayoutNode
  /** Per-widget styling overrides (e.g. fontSize) */
  widgetStyles?: Record<string, { fontSize?: number; labelFontSize?: number; valueFontSize?: number; barFontSize?: number; height?: number }>;
  /** Order of rows in the consumption grid (curr, avg, max, last, min) */
  consumptionGridOrder?: string[];
  /** Percentage thresholds for fuel status colors (0-100) */
  fuelStatusThresholds?: {
    green: number;
    amber: number;
    red: number;
  };
  /** Basis for fuel status coloring consumption calculation */
  fuelStatusBasis?: 'last' | 'avg' | 'min' | 'max';
  /** Number of laps remaining that triggers Red status regardless of percentage */
  fuelStatusRedLaps?: number;
}

export interface BoxConfig {
  id: string;
  /** Layout flow for widgets in this box */
  flow?: 'vertical' | 'horizontal';
  /** Width of the box relative to container */
  width?: '1/1' | '1/2' | '1/3' | '1/4';
  /** Widgets contained in this box, in order */
  widgets: string[];
}

/** Available widgets for the Fuel Calculator */
export type FuelWidgetType =
  | 'fuelLevel'
  | 'lapsRemaining'
  | 'consumption'
  | 'pitWindow'
  | 'endurance'
  | 'scenarios'
  | 'graph'
  | 'confidence'
  | 'economyPredict';
