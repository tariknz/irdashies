/**
 * Utility functions for fuel calculations
 */

import type { FuelLapData } from './types';

// ============================================================================
// Constants - Session Flags (defined once at module level)
// ============================================================================

/** Green flag bit - racing conditions */
export const FLAG_GREEN = 0x00000004; // 1 << 2
/** White flag bit - final lap */
export const FLAG_WHITE = 0x00000002; // 1 << 1
/** Checkered flag bit - race finished */
export const FLAG_CHECKERED = 0x00000001; // 1 << 0
/** Yellow flag bit - caution */
export const FLAG_YELLOW = 0x00004000; // 1 << 14
/** Caution flag bit */
export const FLAG_CAUTION = 0x00008000; // 1 << 15
/** Red flag bit - session stopped */
export const FLAG_RED = 0x00010000; // 1 << 16

/** Combined mask for non-green conditions */
const CAUTION_FLAGS_MASK = FLAG_YELLOW | FLAG_CAUTION | FLAG_RED;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate if a lap's fuel data is reasonable (outlier detection)
 */
export function validateLapData(
  fuelUsed: number,
  lapTime: number,
  recentLaps: FuelLapData[]
): boolean {
  // Basic validation
  if (fuelUsed <= 0 || lapTime <= 0) return false;

  // Need at least 3 laps for statistical validation
  if (recentLaps.length < 3) return true;

  // Statistical outlier detection using Interquartile Range (IQR)
  // More robust than Standard Deviation for skewed fuel data
  const fuelValues = recentLaps.map((l) => l.fuelUsed).sort((a, b) => a - b);
  const q1 = fuelValues[Math.floor(fuelValues.length * 0.25)];
  const q3 = fuelValues[Math.floor(fuelValues.length * 0.75)];
  const iqr = q3 - q1;

  // Use a sensible factor (1.5 is standard, 2.0 is more lenient for racing)
  const factor = 2.0;
  const lowerBound = q1 - factor * iqr;
  const upperBound = q3 + factor * iqr;

  // Additional safety: ensure we don't discard laps that are within 15% of the mean
  // to avoid over-filtering in very consistent sessions
  const mean = fuelValues.reduce((a, b) => a + b, 0) / fuelValues.length;
  const tolerance = mean * 0.15;

  const isWithinIQR = fuelUsed >= lowerBound && fuelUsed <= upperBound;
  const isWithinTolerance = Math.abs(fuelUsed - mean) <= tolerance;

  return isWithinIQR || isWithinTolerance;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate weighted average fuel consumption
 * Recent laps are weighted more heavily than older laps
 */
export function calculateWeightedAverage(laps: FuelLapData[]): number {
  if (laps.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;
  const baseWeight = 1.2;
  const lapCount = laps.length;

  // Use exponential weighting: more recent laps have higher weight
  for (let idx = 0; idx < lapCount; idx++) {
    const weight = baseWeight ** (lapCount - idx - 1);
    weightedSum += laps[idx].fuelUsed * weight;
    weightSum += weight;
  }

  return weightedSum / weightSum;
}

/**
 * Calculate simple average of fuel values
 * More efficient than weighted average when weights aren't needed
 */
export function calculateSimpleAverage(laps: FuelLapData[]): number {
  if (laps.length === 0) return 0;
  let sum = 0;
  for (const lap of laps) {
    sum += lap.fuelUsed;
  }
  return sum / laps.length;
}

/**
 * Calculate average lap time from lap data
 */
export function calculateAvgLapTime(laps: FuelLapData[]): number {
  if (laps.length === 0) return 0;
  let sum = 0;
  for (const lap of laps) {
    sum += lap.lapTime;
  }
  return sum / laps.length;
}

/**
 * Find min and max fuel usage in a single pass
 * More efficient than separate Math.min/max with spread operator
 */
export function findFuelMinMax(laps: FuelLapData[]): {
  min: number;
  max: number;
} {
  if (laps.length === 0) return { min: 0, max: 0 };

  let min = laps[0].fuelUsed;
  let max = laps[0].fuelUsed;

  for (let i = 1; i < laps.length; i++) {
    const fuel = laps[i].fuelUsed;
    if (fuel < min) min = fuel;
    if (fuel > max) max = fuel;
  }

  return { min, max };
}

/**
 * Find the first (lowest) lap number in a collection
 * More efficient than Math.min(...laps.map(l => l.lapNumber))
 */
export function findFirstLapNumber(laps: FuelLapData[]): number {
  if (laps.length === 0) return 0;

  let minLapNumber = laps[0].lapNumber;
  for (let i = 1; i < laps.length; i++) {
    if (laps[i].lapNumber < minLapNumber) {
      minLapNumber = laps[i].lapNumber;
    }
  }
  return minLapNumber;
}

// ============================================================================
// Unit Conversion Functions
// ============================================================================

/** Conversion factor: 1 liter = 0.264172 gallons */
const LITERS_TO_GALLONS = 0.264172;

/**
 * Convert liters to gallons
 */
export function litersToGallons(liters: number): number {
  return liters * LITERS_TO_GALLONS;
}

/**
 * Convert gallons to liters
 */
export function gallonsToLiters(gallons: number): number {
  return gallons / LITERS_TO_GALLONS;
}

/**
 * Format fuel amount for display
 */
export function formatFuel(
  liters: number,
  units: 'L' | 'gal',
  decimals = 2
): string {
  const value = units === 'gal' ? litersToGallons(liters) : liters;
  return `${value.toFixed(decimals)} ${units}`;
}

// ============================================================================
// Lap Detection Functions
// ============================================================================

/**
 * Detect if a lap crossing occurred
 * Lap crossing happens when distance percentage goes from high (>0.9) to low (<0.1)
 */
export function detectLapCrossing(
  currentDistPct: number,
  lastDistPct: number
): boolean {
  // Use stricter threshold to avoid false positives at exact 0.0/1.0
  // Broadened to handle potential telemetry gaps or exact 1.0 values
  return lastDistPct > 0.8 && currentDistPct < 0.2 && currentDistPct < lastDistPct;
}

// ============================================================================
// Session Flag Functions
// ============================================================================

/**
 * Check if current session flags indicate green flag conditions
 */
export function isGreenFlag(sessionFlags: number): boolean {
  return (sessionFlags & CAUTION_FLAGS_MASK) === 0;
}

/**
 * Check if white flag is showing (final lap in timed races)
 */
export function isWhiteFlag(sessionFlags: number): boolean {
  return (sessionFlags & FLAG_WHITE) !== 0;
}

/**
 * Check if checkered flag is showing (race finished)
 */
export function isCheckeredFlag(sessionFlags: number): boolean {
  return (sessionFlags & FLAG_CHECKERED) !== 0;
}

/**
 * Check if either white or checkered flag is showing (final lap / race complete)
 */
export function isFinalLap(sessionFlags: number): boolean {
  return (sessionFlags & (FLAG_WHITE | FLAG_CHECKERED)) !== 0;
}

// ============================================================================
// Confidence Functions
// ============================================================================

/** Threshold for high confidence calculations */
const HIGH_CONFIDENCE_LAPS = 10;
/** Threshold for medium confidence calculations */
const MEDIUM_CONFIDENCE_LAPS = 5;

/**
 * Calculate confidence level based on number of valid laps
 */
export function calculateConfidence(
  validLapCount: number
): 'high' | 'medium' | 'low' {
  if (validLapCount >= HIGH_CONFIDENCE_LAPS) return 'high';
  if (validLapCount >= MEDIUM_CONFIDENCE_LAPS) return 'medium';
  return 'low';
}

// ============================================================================
// Lap Filtering Utilities
// ============================================================================

/**
 * Filter laps to get only valid full racing laps
 * Excludes out-laps and the first lap (from grid/reset)
 */
export function getFullRacingLaps(
  validLaps: FuelLapData[],
  firstLapNumber: number
): FuelLapData[] {
  const result: FuelLapData[] = [];
  for (const lap of validLaps) {
    if (!lap.isOutLap && lap.lapNumber !== firstLapNumber) {
      result.push(lap);
    }
  }
  return result;
}

/**
 * Filter laps to get only green flag laps
 */
export function getGreenFlagLaps(laps: FuelLapData[]): FuelLapData[] {
  const result: FuelLapData[] = [];
  for (const lap of laps) {
    if (lap.isGreenFlag) {
      result.push(lap);
    }
  }
  return result;
}
