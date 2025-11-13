/**
 * Core gap calculation engine using three-tier approach:
 * Tier 1: Position/time records (most accurate)
 * Tier 2: Lap history (median lap times)
 * Tier 3: Class estimates (fallback)
 */

import type {
  CarPositionHistory,
  RelativeGap,
  GapCalculationParams,
  EdgeCaseFlags,
  LapPositionRecord,
} from './types';
import {
  interpolateTime,
  calculateTimeGapFromSamples,
  calculatePositionDifference,
  getMedianLapTime,
} from './InterpolationEngine';

/**
 * Calculate relative gap using Tier 1: Position/time records
 * This is the most accurate method when we have position samples
 */
function calculateTier1Gap(
  playerHistory: CarPositionHistory,
  otherHistory: CarPositionHistory,
  params: GapCalculationParams,
  interpolationMethod: 'linear' | 'cubic',
): RelativeGap | null {
  // Get the most recent valid lap record for the other car
  const otherValidLaps = otherHistory.lapRecords.filter((lap) => lap.isValid);
  if (otherValidLaps.length === 0) return null;

  // Use most recent valid lap
  const otherLapRecord = otherValidLaps[otherValidLaps.length - 1];

  // Need sufficient samples for accurate interpolation
  if (otherLapRecord.samples.length < 10) return null;

  // Get player's best lap record for reference (use their pace)
  const playerValidLaps = playerHistory.lapRecords.filter((lap) => lap.isValid);
  if (playerValidLaps.length === 0) return null;

  const playerLapRecord = playerValidLaps[playerValidLaps.length - 1];
  if (playerLapRecord.samples.length < 10) return null;

  // Calculate time at both car positions
  const otherTimeAtPosition = interpolateTime(
    otherLapRecord.samples,
    params.otherPosition,
    interpolationMethod,
  );

  const playerTimeAtPosition = interpolateTime(
    playerLapRecord.samples,
    params.playerPosition,
    interpolationMethod,
  );

  // Calculate the time gap
  // Convention: positive gap = other car is ahead of player
  //            negative gap = other car is behind player
  const positionDiff = calculatePositionDifference(params.playerPosition, params.otherPosition);

  let timeGap: number;

  if (Math.abs(positionDiff) < 0.001) {
    // Cars are at essentially the same position
    timeGap = 0;
  } else {
    // Convert position difference to time using other car's lap data
    // positionDiff > 0 means other is ahead
    // positionDiff < 0 means other is behind

    // Calculate time at both positions using other car's pace
    const otherTime = interpolateTime(
      otherLapRecord.samples,
      params.otherPosition,
      interpolationMethod,
    );

    const playerPosInOtherCarTime = interpolateTime(
      otherLapRecord.samples,
      params.playerPosition,
      interpolationMethod,
    );

    // Time gap based on position difference using other car's lap data
    // If other is ahead (at 0.6) and player at (0.5):
    //   playerPosInOtherCarTime might be 50s, otherTime might be 60s
    //   gap should be +10s (other is 10s ahead)
    // If other is behind (at 0.4) and player at (0.5):
    //   playerPosInOtherCarTime might be 50s, otherTime might be 40s
    //   gap should be -10s (other is 10s behind)

    timeGap = otherTime.time - playerPosInOtherCarTime.time;

    // Handle wrap-around: if the gap is very large, other car may have crossed the line
    // If gap is more than half a lap time, adjust
    if (timeGap > otherLapRecord.lapTime / 2) {
      timeGap -= otherLapRecord.lapTime;
    } else if (timeGap < -otherLapRecord.lapTime / 2) {
      timeGap += otherLapRecord.lapTime;
    }

    // Adjust confidence based on interpolation quality
    const confidence = Math.min(
      1.0,
      (otherTime.confidence + playerPosInOtherCarTime.confidence) / 2,
    );

    return {
      timeGap,
      tier: 'position-records',
      confidence,
      isEstimated: !otherTime.isInterpolated || !playerPosInOtherCarTime.isInterpolated,
      distanceGap: positionDiff,
    };
  }

  const confidence = Math.min(otherTimeAtPosition.confidence, playerTimeAtPosition.confidence);

  return {
    timeGap,
    tier: 'position-records',
    confidence,
    isEstimated: false,
    distanceGap: positionDiff,
  };
}

/**
 * Calculate relative gap using Tier 2: Lap history (median lap times)
 * Uses completed lap times to estimate time gap based on distance
 */
function calculateTier2Gap(
  playerHistory: CarPositionHistory,
  otherHistory: CarPositionHistory,
  params: GapCalculationParams,
): RelativeGap | null {
  // Get median lap times for both cars
  const playerMedianLapTime = getMedianLapTime(playerHistory.lapRecords);
  const otherMedianLapTime = getMedianLapTime(otherHistory.lapRecords);

  if (!playerMedianLapTime || !otherMedianLapTime) return null;

  // Calculate position difference
  const positionDiff = calculatePositionDifference(params.playerPosition, params.otherPosition);

  // Use the other car's lap time to convert position difference to time
  // This is more accurate than using class average
  const timeGap = positionDiff * otherMedianLapTime;

  // Confidence depends on how many laps we have
  const validLapCount = otherHistory.lapRecords.filter((lap) => lap.isValid).length;
  const confidence = Math.min(0.8, 0.4 + validLapCount * 0.1); // Max 0.8 confidence for Tier 2

  return {
    timeGap,
    tier: 'lap-history',
    confidence,
    isEstimated: true,
    distanceGap: positionDiff,
  };
}

/**
 * Calculate relative gap using Tier 3: Class estimates (fallback)
 * Uses class average lap times - least accurate but always available
 */
function calculateTier3Gap(
  playerEstLapTime: number,
  otherEstLapTime: number,
  params: GapCalculationParams,
): RelativeGap {
  // Calculate position difference
  const positionDiff = calculatePositionDifference(params.playerPosition, params.otherPosition);

  // Use the other car's estimated lap time
  // This is what the current implementation uses
  const baseLapTime = otherEstLapTime > 0 ? otherEstLapTime : playerEstLapTime;
  const timeGap = positionDiff * baseLapTime;

  return {
    timeGap,
    tier: 'class-estimate',
    confidence: 0.3, // Low confidence for class estimates
    isEstimated: true,
    distanceGap: positionDiff,
  };
}

/**
 * Main entry point for gap calculation
 * Tries each tier in order until successful calculation
 */
export function calculateRelativeGap(
  playerHistory: CarPositionHistory | undefined,
  otherHistory: CarPositionHistory | undefined,
  params: GapCalculationParams,
  playerEstLapTime: number,
  otherEstLapTime: number,
  edgeCase: EdgeCaseFlags,
  interpolationMethod: 'linear' | 'cubic' = 'linear',
): RelativeGap {
  // Handle edge cases
  if (edgeCase.isOffTrack || edgeCase.isTelemetryGlitch) {
    // Return estimated gap with low confidence
    return {
      timeGap: 0,
      tier: 'class-estimate',
      confidence: 0.1,
      isEstimated: true,
      distanceGap: 0,
    };
  }

  // Try Tier 1: Position records (most accurate)
  if (playerHistory && otherHistory && !edgeCase.isFirstLap) {
    const tier1Result = calculateTier1Gap(
      playerHistory,
      otherHistory,
      params,
      interpolationMethod,
    );

    if (tier1Result) {
      // Position-based calculation already accounts for on-track gaps correctly
      // No adjustment needed for lapped cars - we want on-track time, not race time
      return tier1Result;
    }
  }

  // Try Tier 2: Lap history (median lap times)
  if (playerHistory && otherHistory && !edgeCase.isFirstLap) {
    const tier2Result = calculateTier2Gap(playerHistory, otherHistory, params);

    if (tier2Result) {
      // Position-based calculation already accounts for on-track gaps correctly
      // No adjustment needed for lapped cars - we want on-track time, not race time
      return tier2Result;
    }
  }

  // Tier 3: Class estimates (fallback - always succeeds)
  const tier3Result = calculateTier3Gap(playerEstLapTime, otherEstLapTime, params);

  // Position-based calculation already accounts for on-track gaps correctly
  // No adjustment needed for lapped cars - we want on-track time, not race time
  return tier3Result;
}

/**
 * Detect edge cases that require special handling
 */
export function detectEdgeCases(
  carIdx: number,
  isOffTrack: boolean,
  isInPits: boolean,
  currentLap: number,
  hasLapHistory: boolean,
): EdgeCaseFlags {
  return {
    isOffTrack,
    isInPits,
    isFirstLap: currentLap <= 1 || !hasLapHistory,
    isLapped: false, // Calculated separately in main calculation
    isTelemetryGlitch: false, // TODO: Implement telemetry validation
  };
}

/**
 * Calculate simple distance-based gap (current implementation)
 * Kept for comparison and fallback
 */
export function calculateSimpleDistanceGap(
  playerPosition: number,
  otherPosition: number,
  playerEstLapTime: number,
  otherEstLapTime: number,
): number {
  const positionDiff = calculatePositionDifference(playerPosition, otherPosition);
  const baseLapTime = Math.max(playerEstLapTime, otherEstLapTime);
  return positionDiff * baseLapTime;
}

/**
 * Validate if a lap should be considered for records
 * @param lapTime Lap time in seconds
 * @param recentLaps Array of recent lap times
 * @returns Whether this lap is valid (not an outlier)
 */
export function isValidLap(lapTime: number, recentLaps: number[]): boolean {
  if (recentLaps.length === 0) return true;
  if (lapTime <= 0) return false;

  // Calculate median and standard deviation
  const sorted = [...recentLaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Calculate standard deviation
  const mean = recentLaps.reduce((sum, t) => sum + t, 0) / recentLaps.length;
  const variance = recentLaps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / recentLaps.length;
  const stdDev = Math.sqrt(variance);

  // Lap is valid if within 2 standard deviations of median
  // or within 10% of median (for small datasets)
  const threshold = Math.max(stdDev * 2, median * 0.1);

  return Math.abs(lapTime - median) <= threshold;
}
