/**
 * Unit tests for fuel calculation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateLapData,
  calculateWeightedAverage,
  litersToGallons,
  gallonsToLiters,
  formatFuel,
  detectLapCrossing,
  isGreenFlag,
  calculateConfidence,
} from './fuelCalculations';
import type { FuelLapData } from './types';

describe('fuelCalculations', () => {
  describe('validateLapData', () => {
    it('should return false for invalid fuel values', () => {
      expect(validateLapData(0, 100, [])).toBe(false);
      expect(validateLapData(-1, 100, [])).toBe(false);
    });

    it('should return false for invalid lap times', () => {
      expect(validateLapData(2.5, 0, [])).toBe(false);
      expect(validateLapData(2.5, -1, [])).toBe(false);
    });

    it('should return true for first laps with no history', () => {
      expect(validateLapData(2.5, 90, [])).toBe(true);
      expect(validateLapData(2.5, 90, [mockLap(1, 2.4, 89)])).toBe(true);
    });

    it('should detect outliers beyond 3 standard deviations', () => {
      const recentLaps = [
        mockLap(1, 2.5, 90),
        mockLap(2, 2.6, 91),
        mockLap(3, 2.4, 89),
        mockLap(4, 2.5, 90),
        mockLap(5, 2.5, 91),
      ];

      expect(validateLapData(2.5, 90, recentLaps)).toBe(true);
      expect(validateLapData(10.0, 90, recentLaps)).toBe(false); // Outlier
    });
  });

  describe('calculateWeightedAverage', () => {
    it('should return 0 for empty array', () => {
      expect(calculateWeightedAverage([])).toBe(0);
    });

    it('should return fuel value for single lap', () => {
      const laps = [mockLap(1, 2.5, 90)];
      expect(calculateWeightedAverage(laps)).toBe(2.5);
    });

    it('should weight recent laps more heavily', () => {
      const laps = [
        mockLap(3, 3.0, 90), // Most recent
        mockLap(2, 2.5, 90), // Middle
        mockLap(1, 2.0, 90), // Oldest
      ];

      const avg = calculateWeightedAverage(laps);
      // Recent lap (3.0) should have more weight
      expect(avg).toBeGreaterThan(2.5);
      expect(avg).toBeLessThan(3.0);
    });
  });

  describe('unit conversions', () => {
    it('should convert liters to gallons', () => {
      expect(litersToGallons(10)).toBeCloseTo(2.64172, 4);
      expect(litersToGallons(0)).toBe(0);
    });

    it('should convert gallons to liters', () => {
      expect(gallonsToLiters(2.64172)).toBeCloseTo(10, 2);
      expect(gallonsToLiters(0)).toBe(0);
    });

    it('should be reversible', () => {
      const liters = 50;
      const gallons = litersToGallons(liters);
      const backToLiters = gallonsToLiters(gallons);
      expect(backToLiters).toBeCloseTo(liters, 4);
    });
  });

  describe('formatFuel', () => {
    it('should format liters with default decimals', () => {
      expect(formatFuel(10.5, 'L')).toBe('10.50 L');
      expect(formatFuel(2.123, 'L')).toBe('2.12 L');
    });

    it('should format gallons with conversion', () => {
      expect(formatFuel(10, 'gal')).toBe('2.64 gal');
    });

    it('should respect custom decimal places', () => {
      expect(formatFuel(10.5, 'L', 1)).toBe('10.5 L');
      expect(formatFuel(10.5, 'L', 3)).toBe('10.500 L');
    });
  });

  describe('detectLapCrossing', () => {
    it('should detect lap crossing from high to low percentage', () => {
      expect(detectLapCrossing(0.05, 0.95)).toBe(true);
      expect(detectLapCrossing(0.02, 0.98)).toBe(true);
    });

    it('should not detect crossing for normal progression', () => {
      expect(detectLapCrossing(0.5, 0.4)).toBe(false);
      expect(detectLapCrossing(0.8, 0.7)).toBe(false);
    });

    it('should not detect crossing from low to high', () => {
      expect(detectLapCrossing(0.95, 0.05)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(detectLapCrossing(0.0, 1.0)).toBe(false);
      expect(detectLapCrossing(0.1, 0.9)).toBe(false);
      expect(detectLapCrossing(0.09, 0.91)).toBe(true);
    });
  });

  describe('isGreenFlag', () => {
    it('should detect green flag (no caution flags)', () => {
      const GREEN_FLAG = 0x00000004; // 1 << 2
      expect(isGreenFlag(GREEN_FLAG)).toBe(true);
      expect(isGreenFlag(0)).toBe(true); // No flags at all
    });

    it('should detect yellow flag', () => {
      const YELLOW_FLAG = 0x00004000; // 1 << 14
      expect(isGreenFlag(YELLOW_FLAG)).toBe(false);
    });

    it('should detect caution flag', () => {
      const CAUTION_FLAG = 0x00008000; // 1 << 15
      expect(isGreenFlag(CAUTION_FLAG)).toBe(false);
    });

    it('should detect red flag', () => {
      const RED_FLAG = 0x00010000; // 1 << 16
      expect(isGreenFlag(RED_FLAG)).toBe(false);
    });

    it('should handle combined flags', () => {
      const YELLOW_AND_GREEN = 0x00004004;
      expect(isGreenFlag(YELLOW_AND_GREEN)).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('should return low confidence for few laps', () => {
      expect(calculateConfidence(0)).toBe('low');
      expect(calculateConfidence(2)).toBe('low');
      expect(calculateConfidence(4)).toBe('low');
    });

    it('should return medium confidence for moderate laps', () => {
      expect(calculateConfidence(5)).toBe('medium');
      expect(calculateConfidence(7)).toBe('medium');
      expect(calculateConfidence(9)).toBe('medium');
    });

    it('should return high confidence for many laps', () => {
      expect(calculateConfidence(10)).toBe('high');
      expect(calculateConfidence(20)).toBe('high');
      expect(calculateConfidence(50)).toBe('high');
    });
  });
});

// Helper function to create mock lap data
function mockLap(
  lapNumber: number,
  fuelUsed: number,
  lapTime: number
): FuelLapData {
  return {
    lapNumber,
    fuelUsed,
    lapTime,
    isGreenFlag: true,
    isValidForCalc: true,
    isOutLap: false,
    timestamp: Date.now(),
  };
}
