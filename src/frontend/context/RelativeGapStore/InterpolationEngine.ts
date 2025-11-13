/**
 * Interpolation engine for calculating time at arbitrary track positions
 * Uses binary search and various interpolation methods
 */

import type { PositionSample, InterpolationResult } from './types';

/**
 * Find the two samples that surround a given position using binary search
 * @param samples Array of position samples (must be sorted by position)
 * @param targetPosition Target position to find (0.0 to 1.0)
 * @returns Indices of the two surrounding samples, or null if not found
 */
export function findSurroundingSamples(
  samples: PositionSample[],
  targetPosition: number,
): { lowerIdx: number; upperIdx: number } | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return { lowerIdx: 0, upperIdx: 0 };

  // Handle edge cases - position before first sample
  if (targetPosition <= samples[0].position) {
    return { lowerIdx: 0, upperIdx: 1 };
  }

  // Position after last sample
  if (targetPosition >= samples[samples.length - 1].position) {
    return { lowerIdx: samples.length - 2, upperIdx: samples.length - 1 };
  }

  // Binary search for the surrounding samples
  let left = 0;
  let right = samples.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midPos = samples[mid].position;

    if (targetPosition === midPos) {
      // Exact match
      return { lowerIdx: mid, upperIdx: mid };
    }

    if (targetPosition < midPos) {
      // Check if target is between mid-1 and mid
      if (mid > 0 && targetPosition > samples[mid - 1].position) {
        return { lowerIdx: mid - 1, upperIdx: mid };
      }
      right = mid - 1;
    } else {
      // targetPosition > midPos
      // Check if target is between mid and mid+1
      if (mid < samples.length - 1 && targetPosition < samples[mid + 1].position) {
        return { lowerIdx: mid, upperIdx: mid + 1 };
      }
      left = mid + 1;
    }
  }

  // Fallback (should not reach here with valid input)
  return null;
}

/**
 * Linear interpolation between two points
 * @param x0 Lower x value
 * @param y0 Lower y value
 * @param x1 Upper x value
 * @param y1 Upper y value
 * @param x Target x value
 * @returns Interpolated y value
 */
export function linearInterpolate(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
): number {
  if (x1 === x0) return y0; // Avoid division by zero

  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

/**
 * Cubic spline interpolation between points
 * Uses Catmull-Rom spline for smooth curves
 * Requires 4 points: p0, p1 (interpolate between these), p2, p3
 * @param samples Array of at least 4 samples
 * @param lowerIdx Index of lower bound sample (p1)
 * @param targetPosition Target position to interpolate
 * @returns Interpolated time value
 */
export function cubicInterpolate(
  samples: PositionSample[],
  lowerIdx: number,
  targetPosition: number,
): number {
  // Need at least 4 points for cubic interpolation
  if (samples.length < 4) {
    // Fall back to linear
    const upperIdx = Math.min(lowerIdx + 1, samples.length - 1);
    return linearInterpolate(
      samples[lowerIdx].position,
      samples[lowerIdx].time,
      samples[upperIdx].position,
      samples[upperIdx].time,
      targetPosition,
    );
  }

  // Get 4 points for cubic interpolation
  // p0 is before lowerIdx, p1 is lowerIdx, p2 is after lowerIdx, p3 is after p2
  const p0Idx = Math.max(0, lowerIdx - 1);
  const p1Idx = lowerIdx;
  const p2Idx = Math.min(lowerIdx + 1, samples.length - 1);
  const p3Idx = Math.min(lowerIdx + 2, samples.length - 1);

  const p0 = samples[p0Idx];
  const p1 = samples[p1Idx];
  const p2 = samples[p2Idx];
  const p3 = samples[p3Idx];

  // Calculate t (normalized position between p1 and p2)
  const t = (targetPosition - p1.position) / (p2.position - p1.position);

  // Catmull-Rom spline formula
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom basis functions
  const a = -0.5 * p0.time + 1.5 * p1.time - 1.5 * p2.time + 0.5 * p3.time;
  const b = p0.time - 2.5 * p1.time + 2.0 * p2.time - 0.5 * p3.time;
  const c = -0.5 * p0.time + 0.5 * p2.time;
  const d = p1.time;

  return a * t3 + b * t2 + c * t + d;
}

/**
 * Interpolate time at a target position using available samples
 * @param samples Array of position samples (must be sorted by position)
 * @param targetPosition Target position (0.0 to 1.0)
 * @param method Interpolation method to use
 * @returns Interpolation result with time and confidence
 */
export function interpolateTime(
  samples: PositionSample[],
  targetPosition: number,
  method: 'linear' | 'cubic' = 'linear',
): InterpolationResult {
  // Handle empty or single sample
  if (samples.length === 0) {
    return {
      time: 0,
      isInterpolated: false,
      confidence: 0,
    };
  }

  if (samples.length === 1) {
    return {
      time: samples[0].time,
      isInterpolated: false,
      confidence: 0.3, // Low confidence with single sample
    };
  }

  // Find surrounding samples
  const surrounding = findSurroundingSamples(samples, targetPosition);
  if (!surrounding) {
    return {
      time: 0,
      isInterpolated: false,
      confidence: 0,
    };
  }

  const { lowerIdx, upperIdx } = surrounding;
  const lowerSample = samples[lowerIdx];
  const upperSample = samples[upperIdx];

  // Check if we're extrapolating (outside sample range)
  const isExtrapolating =
    targetPosition < samples[0].position ||
    targetPosition > samples[samples.length - 1].position;

  let interpolatedTime: number;

  if (method === 'cubic' && samples.length >= 4 && !isExtrapolating) {
    interpolatedTime = cubicInterpolate(samples, lowerIdx, targetPosition);
  } else {
    // Linear interpolation (or fallback for cubic)
    interpolatedTime = linearInterpolate(
      lowerSample.position,
      lowerSample.time,
      upperSample.position,
      upperSample.time,
      targetPosition,
    );
  }

  // Calculate confidence based on sample density and extrapolation
  let confidence = 1.0;

  if (isExtrapolating) {
    // Lower confidence for extrapolation
    confidence = 0.5;
  } else {
    // Confidence decreases with larger gaps between samples
    const sampleGap = upperSample.position - lowerSample.position;
    if (sampleGap > 0.05) {
      // Gap larger than 5%
      confidence = Math.max(0.6, 1.0 - sampleGap * 2);
    } else if (sampleGap >= 0.01) {
      // Normal gaps (1-5%) have good but not perfect confidence
      confidence = 0.9;
    }
  }

  return {
    time: interpolatedTime,
    isInterpolated: !isExtrapolating,
    confidence,
  };
}

/**
 * Calculate time gap between two positions on the same lap
 * @param samples Array of position samples for a lap
 * @param position1 First position (reference)
 * @param position2 Second position (target)
 * @param method Interpolation method
 * @returns Time difference in seconds (positive if position2 is ahead)
 */
export function calculateTimeGapFromSamples(
  samples: PositionSample[],
  position1: number,
  position2: number,
  method: 'linear' | 'cubic' = 'linear',
): InterpolationResult {
  const time1Result = interpolateTime(samples, position1, method);
  const time2Result = interpolateTime(samples, position2, method);

  const timeGap = time2Result.time - time1Result.time;

  // Confidence is the minimum of both interpolations
  const confidence = Math.min(time1Result.confidence, time2Result.confidence);

  // Consider interpolated only if both positions were interpolated
  const isInterpolated = time1Result.isInterpolated && time2Result.isInterpolated;

  return {
    time: timeGap,
    isInterpolated,
    confidence,
  };
}

/**
 * Get median lap record from multiple laps (for filtering outliers)
 * @param lapRecords Array of lap records
 * @returns Median lap time or null if no valid laps
 */
export function getMedianLapTime(lapRecords: Array<{ lapTime: number; isValid: boolean }>): number | null {
  const validLaps = lapRecords.filter((lap) => lap.isValid).map((lap) => lap.lapTime);

  if (validLaps.length === 0) return null;

  const sorted = [...validLaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Normalize position to handle wrap-around at start/finish line
 * @param position Position value (0.0 to 1.0)
 * @returns Normalized position
 */
export function normalizePosition(position: number): number {
  let normalized = position % 1.0;
  if (normalized < 0) normalized += 1.0;
  return normalized;
}

/**
 * Calculate relative position difference with wrap-around handling
 * @param position1 First position (0.0 to 1.0)
 * @param position2 Second position (0.0 to 1.0)
 * @returns Difference (positive if position2 is ahead)
 */
export function calculatePositionDifference(position1: number, position2: number): number {
  let diff = position2 - position1;

  // Handle wrap-around at start/finish line
  if (diff > 0.5) {
    diff -= 1.0;
  } else if (diff < -0.5) {
    diff += 1.0;
  }

  return diff;
}
