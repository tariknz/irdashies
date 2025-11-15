import { describe, it, expect } from 'vitest';
import {
  calculateRelativeGap,
  detectEdgeCases,
  calculateSimpleDistanceGap,
  isValidLap,
} from './RelativeGapCalculator';
import type {
  CarPositionHistory,
  GapCalculationParams,
  EdgeCaseFlags,
  PositionSample,
  LapPositionRecord,
} from './types';

describe('RelativeGapCalculator', () => {
  // Helper function to create test position samples
  function createTestSamples(count = 100): PositionSample[] {
    const samples: PositionSample[] = [];
    for (let i = 0; i < count; i++) {
      samples.push({
        position: i / count,
        time: (i / count) * 100, // 100s lap time
        sessionTime: 1000 + (i / count) * 100,
      });
    }
    return samples;
  }

  // Helper to create a car history with lap records
  function createTestHistory(carIdx: number, lapCount = 3): CarPositionHistory {
    const lapRecords: LapPositionRecord[] = [];
    for (let i = 0; i < lapCount; i++) {
      lapRecords.push({
        lapNumber: i + 1,
        samples: createTestSamples(100),
        lapTime: 100 + i * 0.5, // Slight variation
        completedAt: 1000 + (i + 1) * 100,
        isValid: true,
      });
    }

    return {
      carIdx,
      lapRecords,
      currentLapSamples: [],
      lastPosition: 0,
      currentLapNumber: lapCount + 1,
      lapStartTime: 1000 + lapCount * 100,
    };
  }

  const noEdgeCases: EdgeCaseFlags = {
    isOffTrack: false,
    isInPits: false,
    isFirstLap: false,
    isLapped: false,
    isTelemetryGlitch: false,
  };

  describe('calculateRelativeGap', () => {
    it('should use Tier 1 (position records) when available', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        100,
        noEdgeCases,
        'linear',
      );

      expect(result.tier).toBe('position-records');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.timeGap).toBeCloseTo(10, 0); // 0.1 * 100s = 10s
    });

    it('should use Tier 2 (lap history) when position records insufficient', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);
      // Remove samples to force Tier 2
      otherHistory.lapRecords.forEach((lap) => {
        lap.samples = lap.samples.slice(0, 5); // Only 5 samples, not enough
      });

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        100,
        noEdgeCases,
        'linear',
      );

      expect(result.tier).toBe('lap-history');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });

    it('should use Tier 3 (class estimate) when no history available', () => {
      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 1,
        otherLap: 1,
        sessionTime: 100,
      };

      const result = calculateRelativeGap(
        undefined,
        undefined,
        params,
        100,
        105,
        noEdgeCases,
        'linear',
      );

      expect(result.tier).toBe('class-estimate');
      expect(result.confidence).toBe(0.3);
      expect(result.timeGap).toBeCloseTo(10.5, 1); // 0.1 * 105s
    });

    it('should handle lapped cars by adding lap time', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 5,
        otherLap: 4, // One lap behind
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        105,
        noEdgeCases,
        'linear',
      );

      // Should subtract approximately one lap time (they're behind)
      expect(result.timeGap).toBeLessThan(0);
      expect(Math.abs(result.timeGap)).toBeGreaterThan(90); // Close to a lap time
    });

    it('should return low confidence for off-track cars', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const edgeCases: EdgeCaseFlags = {
        ...noEdgeCases,
        isOffTrack: true,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        100,
        edgeCases,
        'linear',
      );

      expect(result.confidence).toBe(0.1);
      expect(result.isEstimated).toBe(true);
    });

    it('should handle multi-class racing with different lap times', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      // Modify other car to be faster (different class)
      otherHistory.lapRecords.forEach((lap) => {
        lap.lapTime = 90; // 10s faster per lap
        lap.samples = lap.samples.map((s) => ({
          ...s,
          time: s.time * 0.9, // Scale time proportionally
        }));
      });

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.6,
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        90,
        noEdgeCases,
        'linear',
      );

      // Gap should use other car's faster pace
      expect(result.tier).toBe('position-records');
      expect(result.timeGap).toBeCloseTo(9, 0); // 0.1 * 90s = 9s
    });

    it('should handle cars at same position', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.5,
        otherPosition: 0.5, // Same position
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        100,
        noEdgeCases,
        'linear',
      );

      expect(result.timeGap).toBeCloseTo(0, 1);
    });

    it('should handle position wrap-around at start/finish', () => {
      const playerHistory = createTestHistory(0, 3);
      const otherHistory = createTestHistory(1, 3);

      const params: GapCalculationParams = {
        playerCarIdx: 0,
        otherCarIdx: 1,
        playerPosition: 0.95,
        otherPosition: 0.05, // Crossed line, ahead
        playerLap: 4,
        otherLap: 4,
        sessionTime: 1500,
      };

      const result = calculateRelativeGap(
        playerHistory,
        otherHistory,
        params,
        100,
        100,
        noEdgeCases,
        'linear',
      );

      // Should be positive (other is ahead) and small (only 0.1 track difference)
      expect(result.timeGap).toBeGreaterThan(0);
      expect(result.timeGap).toBeLessThan(20);
    });
  });

  describe('detectEdgeCases', () => {
    it('should detect off-track condition', () => {
      const flags = detectEdgeCases(0, true, false, 5, true);
      expect(flags.isOffTrack).toBe(true);
    });

    it('should detect pit lane', () => {
      const flags = detectEdgeCases(0, false, true, 5, true);
      expect(flags.isInPits).toBe(true);
    });

    it('should detect first lap with no history', () => {
      const flags = detectEdgeCases(0, false, false, 1, false);
      expect(flags.isFirstLap).toBe(true);
    });

    it('should detect early lap even with history', () => {
      const flags = detectEdgeCases(0, false, false, 1, true);
      expect(flags.isFirstLap).toBe(true);
    });

    it('should not flag first lap when lap > 1 and has history', () => {
      const flags = detectEdgeCases(0, false, false, 5, true);
      expect(flags.isFirstLap).toBe(false);
    });
  });

  describe('calculateSimpleDistanceGap', () => {
    it('should calculate gap using simple distance method', () => {
      const result = calculateSimpleDistanceGap(0.5, 0.6, 100, 100);
      expect(result).toBeCloseTo(10, 1); // 0.1 * 100s
    });

    it('should use max lap time for multi-class', () => {
      const result = calculateSimpleDistanceGap(0.5, 0.6, 100, 110);
      expect(result).toBeCloseTo(11, 1); // 0.1 * 110s (max)
    });

    it('should handle wrap-around', () => {
      const result = calculateSimpleDistanceGap(0.9, 0.1, 100, 100);
      expect(result).toBeCloseTo(20, 1); // 0.2 * 100s (wrapped)
    });

    it('should handle negative gaps (behind)', () => {
      const result = calculateSimpleDistanceGap(0.6, 0.5, 100, 100);
      expect(result).toBeCloseTo(-10, 1);
    });
  });

  describe('isValidLap', () => {
    it('should consider first lap valid', () => {
      const result = isValidLap(100, []);
      expect(result).toBe(true);
    });

    it('should reject zero or negative lap time', () => {
      const result = isValidLap(0, [100, 102]);
      expect(result).toBe(false);
    });

    it('should accept lap within normal range', () => {
      const recentLaps = [100, 101, 102, 99, 101];
      const result = isValidLap(100.5, recentLaps);
      expect(result).toBe(true);
    });

    it('should reject extreme outlier', () => {
      const recentLaps = [100, 101, 102, 99, 101];
      const result = isValidLap(150, recentLaps); // 50% slower
      expect(result).toBe(false);
    });

    it('should handle small dataset with percentage threshold', () => {
      const recentLaps = [100, 102];
      const result = isValidLap(95, recentLaps); // Within 10%
      expect(result).toBe(true);
    });

    it('should reject lap outside percentage threshold', () => {
      const recentLaps = [100, 102];
      const result = isValidLap(89, recentLaps); // > 10% faster
      expect(result).toBe(false);
    });

    it('should handle consistent lap times', () => {
      const recentLaps = [100, 100, 100, 100];
      const result = isValidLap(100, recentLaps);
      expect(result).toBe(true);
    });

    it('should allow slight variation in consistent times', () => {
      const recentLaps = [100, 100, 100, 100];
      const result = isValidLap(105, recentLaps); // 5% variance
      expect(result).toBe(true);
    });
  });
});
