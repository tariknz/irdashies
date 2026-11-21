import { describe, expect, it } from 'vitest';
import {
  getTemperatureCondition,
  getWearCondition,
  isAvailable,
  tyreZoneTemperatures,
} from './tyreConditions';

describe('tyre conditions', () => {
  it('maps temperature thresholds to cold, optimal, and hot', () => {
    expect(getTemperatureCondition(69.9, 70, 100)).toBe('cold');
    expect(getTemperatureCondition(70, 70, 100)).toBe('optimal');
    expect(getTemperatureCondition(100, 70, 100)).toBe('optimal');
    expect(getTemperatureCondition(100.1, 70, 100)).toBe('hot');
  });

  it('maps remaining tread to healthy, worn, and replacement states', () => {
    expect(getWearCondition(0.61, 60, 30)).toBe('healthy');
    expect(getWearCondition(0.6, 60, 30)).toBe('worn');
    expect(getWearCondition(0.301, 60, 30)).toBe('worn');
    expect(getWearCondition(0.3, 60, 30)).toBe('replace');
    expect(getWearCondition(0.299, 60, 30)).toBe('replace');
  });

  it('keeps missing and invalid telemetry neutral', () => {
    for (const value of [undefined, Number.NaN, -1]) {
      expect(isAvailable(value)).toBe(false);
      expect(getTemperatureCondition(value, 70, 100)).toBe('unavailable');
      expect(getWearCondition(value, 60, 30)).toBe('unavailable');
    }
  });

  it('orders each tyre inner, middle, outer from the car-frame zones', () => {
    const left = [10, 11, 12, 13];
    const middle = [20, 21, 22, 23];
    const right = [30, 31, 32, 33];

    expect(tyreZoneTemperatures(0, left, middle, right)).toEqual([30, 20, 10]);
    expect(tyreZoneTemperatures(1, left, middle, right)).toEqual([11, 21, 31]);
    expect(tyreZoneTemperatures(2, left, middle, right)).toEqual([32, 22, 12]);
    expect(tyreZoneTemperatures(3, left, middle, right)).toEqual([13, 23, 33]);
    expect(tyreZoneTemperatures(0, undefined, undefined, undefined)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});
