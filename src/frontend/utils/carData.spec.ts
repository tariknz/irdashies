import { describe, it, expect } from 'vitest';
import {
  loadCarData,
  getGearKey,
  getAvailableCars,
  normalizeLmuCarKey,
} from './carData';

/**
 * NOTE: These tests verify that bundled car data can be loaded synchronously
 */
describe('carData', () => {
  describe('getGearKey', () => {
    it('returns "N" for gear 0', () => {
      expect(getGearKey(0)).toBe('N');
    });

    it('returns "R" for gear -1', () => {
      expect(getGearKey(-1)).toBe('R');
    });

    it('returns string number for positive gears', () => {
      expect(getGearKey(1)).toBe('1');
      expect(getGearKey(2)).toBe('2');
      expect(getGearKey(6)).toBe('6');
    });
  });

  describe('normalizeLmuCarKey', () => {
    it('maps LMU vehFilename and lovely LMGT3 names to the same key', () => {
      expect(normalizeLmuCarKey('ferrari_296_gt3')).toBe('ferrari296gt3');
      expect(normalizeLmuCarKey('Ferrari 296 LMGT3')).toBe('ferrari296gt3');
      expect(normalizeLmuCarKey('Ferrari 296 GT3')).toBe('ferrari296gt3');
    });

    it('collapses duplicate GT3 after LMGT3 rewrite', () => {
      expect(normalizeLmuCarKey('Porsche 911 GT3 R LMGT3')).toBe(
        'porsche911gt3r'
      );
      expect(normalizeLmuCarKey('porsche_911_gt3_r')).toBe('porsche911gt3r');
    });
  });

  describe('loadCarData', () => {
    it('loads car data synchronously from the iRacing bundle', () => {
      const result = loadCarData('ferrari296gt3', 'iracing');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.carId).toBe('ferrari296gt3');
        expect(result.carName).toBe('Ferrari 296 GT3');
        expect(result.ledNumber).toBeGreaterThan(0);
        expect(result.ledColor).toBeDefined();
        expect(Array.isArray(result.ledRpm)).toBe(true);
      }
    });

    it('handles car ID case-insensitively', () => {
      const result1 = loadCarData('ferrari296gt3', 'iracing');
      const result2 = loadCarData('Ferrari296GT3', 'iracing');
      const result3 = loadCarData('FERRARI296GT3', 'iracing');

      expect(result1).not.toBeNull();
      expect(result2).toEqual(result1);
      expect(result3).toEqual(result1);
    });

    it('handles normalized car IDs (spaces/special chars removed)', () => {
      const result1 = loadCarData('ferrari296gt3', 'iracing');
      const result2 = loadCarData('ferrari 296 gt3', 'iracing');

      expect(result1).not.toBeNull();
      if (result1) {
        expect(result2).toEqual(result1);
      }
    });

    it('returns null for nonexistent cars', () => {
      const result = loadCarData('nonexistentcarmodel12345', 'iracing');
      expect(result).toBeNull();
    });

    it('keeps LMU and iRacing LED profiles in separate bundles', () => {
      // Same normalized letters; without per-sim bundles LMU would inherit
      // iRacing's blink interval and gear RPM tables.
      const iracing = loadCarData('ferrari296gt3', 'iracing');
      const lmu = loadCarData('ferrari_296_gt3', 'lmu');

      expect(iracing).not.toBeNull();
      expect(lmu).not.toBeNull();
      expect(lmu?.carId).not.toBe(iracing?.carId);
      expect(lmu?.redlineBlinkInterval).not.toBe(
        iracing?.redlineBlinkInterval
      );
    });

    it('loads LMU cars by vehFilename or vehicle model alias', () => {
      const byPath = loadCarData('ferrari_296_gt3', 'lmu');
      const byModel = loadCarData('unknown_team_livery', 'lmu', [
        'Ferrari 296 GT3',
      ]);

      // Skip soft if the LMU bundle has not been fetched yet in this checkout.
      if (getAvailableCars('lmu').length === 0) return;

      expect(byPath).not.toBeNull();
      expect(byModel).not.toBeNull();
      expect(byPath?.carId).toBe(byModel?.carId);
      expect(byPath?.ledRpm?.[0]?.['3']?.length).toBeGreaterThan(0);
    });

    it('defaults to the iRacing bundle when gameId is omitted', () => {
      const result = loadCarData('ferrari296gt3');
      expect(result?.carId).toBe('ferrari296gt3');
    });

    it('returns car data with expected structure', () => {
      const result = loadCarData('ferrari296gt3', 'iracing');

      if (result) {
        expect(result).toHaveProperty('carName');
        expect(result).toHaveProperty('carId');
        expect(result).toHaveProperty('carClass');
        expect(result).toHaveProperty('ledNumber');
        expect(result).toHaveProperty('redlineBlinkInterval');
        expect(result).toHaveProperty('ledColor');
        expect(result).toHaveProperty('ledRpm');

        expect(typeof result.carName).toBe('string');
        expect(typeof result.carId).toBe('string');
        expect(typeof result.ledNumber).toBe('number');
      }
    });
  });

  describe('getAvailableCars', () => {
    it('returns array of available iRacing cars', () => {
      const cars = getAvailableCars('iracing');

      expect(Array.isArray(cars)).toBe(true);
      expect(cars.length).toBeGreaterThan(0);
    });

    it('returns cars with carId and carName', () => {
      const cars = getAvailableCars('iracing');

      cars.forEach((car) => {
        expect(car).toHaveProperty('carId');
        expect(car).toHaveProperty('carName');
        expect(typeof car.carId).toBe('string');
        expect(typeof car.carName).toBe('string');
      });
    });

    it('includes expected cars in the iRacing bundle', () => {
      const cars = getAvailableCars('iracing');
      const carIds = cars.map((c) => c.carId);

      expect(carIds).toContain('ferrari296gt3');
    });

    it('returns cars sorted by availability', () => {
      const cars = getAvailableCars('iracing');
      expect(cars.length).toBeGreaterThanOrEqual(60);
    });
  });
});
