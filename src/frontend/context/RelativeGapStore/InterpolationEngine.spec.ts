import { describe, it, expect } from 'vitest';
import {
  findSurroundingSamples,
  linearInterpolate,
  cubicInterpolate,
  interpolateTime,
  calculateTimeGapFromSamples,
  getMedianLapTime,
  normalizePosition,
  calculatePositionDifference,
} from './InterpolationEngine';
import type { PositionSample } from './types';

describe('InterpolationEngine', () => {
  describe('findSurroundingSamples', () => {
    it('should return null for empty array', () => {
      const result = findSurroundingSamples([], 0.5);
      expect(result).toBeNull();
    });

    it('should return same index for single sample', () => {
      const samples: PositionSample[] = [
        { position: 0.5, time: 50, sessionTime: 100 },
      ];
      const result = findSurroundingSamples(samples, 0.5);
      expect(result).toEqual({ lowerIdx: 0, upperIdx: 0 });
    });

    it('should find surrounding samples for position in middle', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.25, time: 25, sessionTime: 125 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 0.75, time: 75, sessionTime: 175 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = findSurroundingSamples(samples, 0.4);
      expect(result).toEqual({ lowerIdx: 1, upperIdx: 2 });
    });

    it('should handle position before first sample', () => {
      const samples: PositionSample[] = [
        { position: 0.25, time: 25, sessionTime: 125 },
        { position: 0.5, time: 50, sessionTime: 150 },
      ];

      const result = findSurroundingSamples(samples, 0.1);
      expect(result).toEqual({ lowerIdx: 0, upperIdx: 1 });
    });

    it('should handle position after last sample', () => {
      const samples: PositionSample[] = [
        { position: 0.25, time: 25, sessionTime: 125 },
        { position: 0.5, time: 50, sessionTime: 150 },
      ];

      const result = findSurroundingSamples(samples, 0.9);
      expect(result).toEqual({ lowerIdx: 0, upperIdx: 1 });
    });

    it('should find exact match', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = findSurroundingSamples(samples, 0.5);
      expect(result).toEqual({ lowerIdx: 1, upperIdx: 1 });
    });
  });

  describe('linearInterpolate', () => {
    it('should interpolate value at midpoint', () => {
      const result = linearInterpolate(0, 0, 1, 100, 0.5);
      expect(result).toBe(50);
    });

    it('should interpolate value at 1/4 point', () => {
      const result = linearInterpolate(0, 0, 1, 100, 0.25);
      expect(result).toBe(25);
    });

    it('should handle exact match at lower bound', () => {
      const result = linearInterpolate(0, 0, 1, 100, 0);
      expect(result).toBe(0);
    });

    it('should handle exact match at upper bound', () => {
      const result = linearInterpolate(0, 0, 1, 100, 1);
      expect(result).toBe(100);
    });

    it('should handle non-zero lower bound', () => {
      const result = linearInterpolate(0.25, 25, 0.75, 75, 0.5);
      expect(result).toBe(50);
    });

    it('should handle same x values (avoid division by zero)', () => {
      const result = linearInterpolate(0.5, 50, 0.5, 60, 0.5);
      expect(result).toBe(50);
    });
  });

  describe('cubicInterpolate', () => {
    it('should fall back to linear with less than 4 samples', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = cubicInterpolate(samples, 0, 0.25);
      // Should be linear interpolation between samples[0] and samples[1]
      expect(result).toBeCloseTo(25, 1);
    });

    it('should perform cubic interpolation with sufficient samples', () => {
      // Create a smooth curve
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.25, time: 20, sessionTime: 120 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 0.75, time: 80, sessionTime: 180 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = cubicInterpolate(samples, 1, 0.375);
      // Result should be between samples[1] and samples[2]
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(50);
    });
  });

  describe('interpolateTime', () => {
    it('should return zero confidence for empty samples', () => {
      const result = interpolateTime([], 0.5, 'linear');
      expect(result.confidence).toBe(0);
      expect(result.isInterpolated).toBe(false);
    });

    it('should return low confidence for single sample', () => {
      const samples: PositionSample[] = [
        { position: 0.5, time: 50, sessionTime: 150 },
      ];

      const result = interpolateTime(samples, 0.5, 'linear');
      expect(result.confidence).toBe(0.3);
      expect(result.time).toBe(50);
    });

    it('should interpolate time with good confidence', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.1, time: 10, sessionTime: 110 },
        { position: 0.2, time: 20, sessionTime: 120 },
        { position: 0.3, time: 30, sessionTime: 130 },
      ];

      const result = interpolateTime(samples, 0.15, 'linear');
      expect(result.time).toBeCloseTo(15, 1);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8); // Samples at 10% intervals = 0.9 confidence
      expect(result.isInterpolated).toBe(true);
    });

    it('should reduce confidence for large sample gaps', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.2, time: 20, sessionTime: 120 }, // Large gap
      ];

      const result = interpolateTime(samples, 0.1, 'linear');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should mark extrapolation with reduced confidence', () => {
      const samples: PositionSample[] = [
        { position: 0.2, time: 20, sessionTime: 120 },
        { position: 0.4, time: 40, sessionTime: 140 },
      ];

      const result = interpolateTime(samples, 0.1, 'linear'); // Before first sample
      expect(result.isInterpolated).toBe(false);
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('calculateTimeGapFromSamples', () => {
    it('should calculate positive gap when position2 is ahead', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.25, time: 25, sessionTime: 125 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 0.75, time: 75, sessionTime: 175 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = calculateTimeGapFromSamples(samples, 0.25, 0.5, 'linear');
      expect(result.time).toBeCloseTo(25, 1); // 50s - 25s = 25s
    });

    it('should calculate negative gap when position2 is behind', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.25, time: 25, sessionTime: 125 },
        { position: 0.5, time: 50, sessionTime: 150 },
        { position: 0.75, time: 75, sessionTime: 175 },
        { position: 1.0, time: 100, sessionTime: 200 },
      ];

      const result = calculateTimeGapFromSamples(samples, 0.5, 0.25, 'linear');
      expect(result.time).toBeCloseTo(-25, 1); // 25s - 50s = -25s
    });

    it('should have lower confidence when either position has low confidence', () => {
      const samples: PositionSample[] = [
        { position: 0.0, time: 0, sessionTime: 100 },
        { position: 0.5, time: 50, sessionTime: 150 }, // Large gap
      ];

      const result = calculateTimeGapFromSamples(samples, 0.1, 0.4, 'linear');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('getMedianLapTime', () => {
    it('should return null for empty array', () => {
      const result = getMedianLapTime([]);
      expect(result).toBeNull();
    });

    it('should return null when no valid laps', () => {
      const result = getMedianLapTime([
        { lapTime: 100, isValid: false },
        { lapTime: 105, isValid: false },
      ]);
      expect(result).toBeNull();
    });

    it('should return median of odd number of laps', () => {
      const result = getMedianLapTime([
        { lapTime: 100, isValid: true },
        { lapTime: 105, isValid: true },
        { lapTime: 102, isValid: true },
      ]);
      expect(result).toBe(102);
    });

    it('should return median of even number of laps', () => {
      const result = getMedianLapTime([
        { lapTime: 100, isValid: true },
        { lapTime: 110, isValid: true },
        { lapTime: 102, isValid: true },
        { lapTime: 108, isValid: true },
      ]);
      expect(result).toBe(105); // (102 + 108) / 2
    });

    it('should ignore invalid laps', () => {
      const result = getMedianLapTime([
        { lapTime: 100, isValid: true },
        { lapTime: 200, isValid: false }, // Outlier, invalid
        { lapTime: 102, isValid: true },
        { lapTime: 300, isValid: false }, // Outlier, invalid
      ]);
      expect(result).toBe(101); // Median of 100, 102
    });
  });

  describe('normalizePosition', () => {
    it('should return position as-is when in range', () => {
      expect(normalizePosition(0.5)).toBe(0.5);
      expect(normalizePosition(0.0)).toBe(0.0);
      expect(normalizePosition(0.99)).toBe(0.99);
    });

    it('should normalize position >= 1.0', () => {
      expect(normalizePosition(1.0)).toBeCloseTo(0.0, 5);
      expect(normalizePosition(1.5)).toBeCloseTo(0.5, 5);
      expect(normalizePosition(2.0)).toBeCloseTo(0.0, 5);
    });

    it('should normalize negative position', () => {
      expect(normalizePosition(-0.5)).toBeCloseTo(0.5, 5);
      expect(normalizePosition(-1.0)).toBeCloseTo(0.0, 5);
    });
  });

  describe('calculatePositionDifference', () => {
    it('should calculate positive difference when position2 is ahead', () => {
      const result = calculatePositionDifference(0.3, 0.5);
      expect(result).toBeCloseTo(0.2, 5);
    });

    it('should calculate negative difference when position2 is behind', () => {
      const result = calculatePositionDifference(0.5, 0.3);
      expect(result).toBeCloseTo(-0.2, 5);
    });

    it('should handle wrap-around when position2 crosses start/finish', () => {
      // position1 at 0.9, position2 at 0.1 (crossed line, ahead by 0.2)
      const result = calculatePositionDifference(0.9, 0.1);
      expect(result).toBeCloseTo(0.2, 5);
    });

    it('should handle wrap-around when position1 crosses start/finish', () => {
      // position1 at 0.1, position2 at 0.9 (behind by 0.2)
      const result = calculatePositionDifference(0.1, 0.9);
      expect(result).toBeCloseTo(-0.2, 5);
    });

    it('should return zero for same position', () => {
      const result = calculatePositionDifference(0.5, 0.5);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should handle exactly halfway around track', () => {
      const result = calculatePositionDifference(0.0, 0.5);
      expect(result).toBeCloseTo(0.5, 5);
    });
  });
});
