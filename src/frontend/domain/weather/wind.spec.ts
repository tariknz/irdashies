import { describe, expect, it } from 'vitest';
import {
  getDemoWindData,
  getWindIntensityClass,
  WIND_DEMO_INTERVAL_MS,
} from './wind';

describe('wind domain', () => {
  describe('getWindIntensityClass', () => {
    it('returns white when speed is undefined or below 5', () => {
      expect(getWindIntensityClass(undefined)).toBe('text-white');
      expect(getWindIntensityClass(0)).toBe('text-white');
      expect(getWindIntensityClass(4.9)).toBe('text-white');
    });

    it('scales colour through the intensity ramp', () => {
      expect(getWindIntensityClass(5)).toBe('text-sky-300');
      expect(getWindIntensityClass(14.9)).toBe('text-sky-300');
      expect(getWindIntensityClass(15)).toBe('text-emerald-300');
      expect(getWindIntensityClass(29.9)).toBe('text-emerald-300');
      expect(getWindIntensityClass(30)).toBe('text-orange-300');
      expect(getWindIntensityClass(39.9)).toBe('text-orange-300');
      expect(getWindIntensityClass(40)).toBe('text-red-400');
      expect(getWindIntensityClass(200)).toBe('text-red-400');
    });
  });

  describe('getDemoWindData', () => {
    it('returns the first sample in m/s for metric mode', () => {
      const sample = getDemoWindData(0, true);
      expect(sample.speedMs).toBeCloseTo(2 / 3.6);
      expect(sample.direction).toBeCloseTo(0);
    });

    it('converts the demo speed when in imperial mode', () => {
      const sample = getDemoWindData(0, false);
      expect(sample.speedMs).toBeCloseTo(2 / 2.23694);
    });

    it('cycles through the demo samples by index', () => {
      const samples = [0, 1, 2, 3, 4, 5].map((i) => getDemoWindData(i, true));
      expect(samples[1].direction).toBeCloseTo(Math.PI * 0.25);
      expect(samples[4].direction).toBeCloseTo(Math.PI * 1.75);
      expect(samples[5].direction).toBeCloseTo(samples[0].direction);
    });
  });

  it('exposes a cycling interval that is at least one frame', () => {
    expect(WIND_DEMO_INTERVAL_MS).toBeGreaterThan(16);
  });
});
