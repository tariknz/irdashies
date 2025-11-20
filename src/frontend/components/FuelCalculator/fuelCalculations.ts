/**
 * Utility functions for fuel calculations
 */

import type { FuelLapData } from './types';

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

  // Statistical outlier detection
  const fuelValues = recentLaps.map((l) => l.fuelUsed);
  const mean = fuelValues.reduce((a, b) => a + b) / fuelValues.length;
  const variance =
    fuelValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) /
    fuelValues.length;
  const stdDev = Math.sqrt(variance);

  // Use minimum threshold of 15% of mean to handle fuel saving scenarios
  // This ensures laps with different driving styles (normal vs fuel saving) are accepted
  // Example: 1.08L normal, 0.97L ultra save = ~10% difference, well within 15%
  const minThreshold = mean * 0.15;
  const threshold = Math.max(3 * stdDev, minThreshold);

  return Math.abs(fuelUsed - mean) <= threshold;
}

/**
 * Calculate weighted average fuel consumption
 * Recent laps are weighted more heavily than older laps
 */
export function calculateWeightedAverage(laps: FuelLapData[]): number {
  if (laps.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  // Use exponential weighting: more recent laps have higher weight
  laps.forEach((lap, idx) => {
    const weight = Math.pow(1.2, laps.length - idx - 1);
    weightedSum += lap.fuelUsed * weight;
    weightSum += weight;
  });

  return weightedSum / weightSum;
}

/**
 * Convert liters to gallons
 */
export function litersToGallons(liters: number): number {
  return liters * 0.264172;
}

/**
 * Convert gallons to liters
 */
export function gallonsToLiters(gallons: number): number {
  return gallons / 0.264172;
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

/**
 * Detect if a lap crossing occurred
 * Lap crossing happens when distance percentage goes from high (>0.9) to low (<0.1)
 */
export function detectLapCrossing(
  currentDistPct: number,
  lastDistPct: number
): boolean {
  // Use stricter threshold to avoid false positives at exact 0.0/1.0
  return lastDistPct > 0.9 && currentDistPct < 0.1 && lastDistPct < 1.0;
}

/**
 * Check if current session flags indicate green flag conditions
 */
export function isGreenFlag(sessionFlags: number): boolean {
  const YELLOW_FLAG = 0x00004000; // 1 << 14
  const CAUTION_FLAG = 0x00008000; // 1 << 15
  const RED_FLAG = 0x00010000; // 1 << 16

  return (
    (sessionFlags & (YELLOW_FLAG | CAUTION_FLAG | RED_FLAG)) === 0
  );
}

/**
 * Calculate confidence level based on number of valid laps
 */
export function calculateConfidence(
  validLapCount: number
): 'high' | 'medium' | 'low' {
  if (validLapCount >= 10) return 'high';
  if (validLapCount >= 5) return 'medium';
  return 'low';
}
