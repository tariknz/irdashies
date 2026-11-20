import { beforeAll, describe, it, expect, vi } from 'vitest';
import {
  isLmuCarBundleLoaded,
  loadCarData,
  loadLmuCarBundle,
  loadLmuCarData,
  subscribeLmuCarBundle,
  getGearKey,
  getAvailableCars,
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

  describe('loadCarData', () => {
    it('loads car data synchronously from bundle', () => {
      // Ferrari 296 GT3 should be in the bundle
      const result = loadCarData('ferrari296gt3');

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
      const result1 = loadCarData('ferrari296gt3');
      const result2 = loadCarData('Ferrari296GT3');
      const result3 = loadCarData('FERRARI296GT3');

      expect(result1).not.toBeNull();
      expect(result2).toEqual(result1);
      expect(result3).toEqual(result1);
    });

    it('handles normalized car IDs (spaces/special chars removed)', () => {
      // Try loading with a normalized version
      const result1 = loadCarData('ferrari296gt3');
      const result2 = loadCarData('ferrari 296 gt3');

      expect(result1).not.toBeNull();
      if (result1) {
        expect(result2).toEqual(result1);
      }
    });

    it('returns null for nonexistent cars', () => {
      const result = loadCarData('nonexistentcarmodel12345');
      expect(result).toBeNull();
    });

    it('ignores game parameter (only iRacing data is bundled)', () => {
      const result1 = loadCarData('ferrari296gt3', 'iracing');
      const result2 = loadCarData('ferrari296gt3', 'assettocorsa');
      const result3 = loadCarData('ferrari296gt3', 'automobilista2');

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('returns car data with expected structure', () => {
      const result = loadCarData('ferrari296gt3');

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
    it('returns array of available cars', () => {
      const cars = getAvailableCars();

      expect(Array.isArray(cars)).toBe(true);
      expect(cars.length).toBeGreaterThan(0);
    });

    it('returns cars with carId and carName', () => {
      const cars = getAvailableCars();

      cars.forEach((car) => {
        expect(car).toHaveProperty('carId');
        expect(car).toHaveProperty('carName');
        expect(typeof car.carId).toBe('string');
        expect(typeof car.carName).toBe('string');
      });
    });

    it('includes expected cars in the bundle', () => {
      const cars = getAvailableCars();
      const carIds = cars.map((c) => c.carId);

      // These cars should be in the bundle
      expect(carIds).toContain('ferrari296gt3');
    });

    it('returns cars sorted by availability', () => {
      const cars = getAvailableCars();
      expect(cars.length).toBeGreaterThanOrEqual(60);
    });
  });

  describe('loadLmuCarBundle', () => {
    it('holds no LMU data until it is asked to load', async () => {
      expect(isLmuCarBundleLoaded()).toBe(false);
      expect(loadLmuCarData('Oreca 07', 'Team #1:WEC')).toBeNull();

      const listener = vi.fn();
      const unsubscribe = subscribeLmuCarBundle(listener);
      await loadLmuCarBundle();
      await loadLmuCarBundle();
      unsubscribe();

      expect(isLmuCarBundleLoaded()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(loadLmuCarData('Oreca 07', 'Team #1:WEC')?.carName).toBe(
        'Oreca 07'
      );
    });
  });

  describe('loadLmuCarData', () => {
    beforeAll(async () => {
      await loadLmuCarBundle();
    });

    it.each([
      ['Ferrari 296 LMGT3 Evo', 'ferrari-296-lmgt3-evo'],
      ['Porsche 911 GT3 R LMGT3', 'porsche-911-gt3-r-lmgt3'],
      ['Mercedes-AMG LMGT3', 'mercedes-amg-lmgt3'],
      ['Chevrolet Corvette Z06 LMGT3.', 'chevrolet-corvette-z06-lmgt3'],
      ['Ligier JS P325', 'ligier-js-p325'],
    ])('finds %s by the model LMU reports', (carModel, key) => {
      const result = loadLmuCarData(carModel, 'Some Team #7:WEC');

      expect(result?.carName).toBe(carModel);
      expect(result).toBe(loadLmuCarData(key));
    });

    it('takes the series variant when the entry names one', () => {
      const elms = loadLmuCarData('Oreca 07', 'DKR Engineering #3:ELMS26');
      const wec = loadLmuCarData('Oreca 07', 'United Autosports #22:WEC');

      expect(elms?.carName).toBe('Oreca 07 ELMS');
      expect(elms?.carClass).toBe('LMP2_ELMS');
      expect(wec?.carName).toBe('Oreca 07');
      expect(wec?.carClass).toBe('LMP2');
      expect(elms?.ledRpm[0]['1'][0]).not.toBe(wec?.ledRpm[0]['1'][0]);
    });

    it('falls back to the model when the entry has no series', () => {
      expect(loadLmuCarData('Oreca 07', 'Oreca 07')?.carClass).toBe('LMP2');
    });

    it.each([undefined, '', 'Unreleased Prototype 2030'])(
      'returns null for the model %s',
      (carModel) => {
        expect(loadLmuCarData(carModel, 'Team #1:WEC')).toBeNull();
      }
    );

    it('leaves the iRacing lookup on the iRacing bundle', () => {
      expect(loadCarData('Ferrari 296 LMGT3 Evo')).toBeNull();
      expect(loadCarData('ferrari296gt3')?.carName).toBe('Ferrari 296 GT3');
    });
  });
});
