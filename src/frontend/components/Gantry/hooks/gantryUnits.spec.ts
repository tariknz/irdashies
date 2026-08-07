import { describe, it, expect } from 'vitest';
import {
  KPH_PER_MPH,
  kphToMph,
  mphToKph,
  resolveGantryUnits,
  speedFromDisplay,
  speedMaxToDisplay,
  speedMinToDisplay,
  speedToDisplay,
} from './gantryUnits';

describe('kphToMph / mphToKph', () => {
  it('converts a known value', () => {
    expect(kphToMph(100)).toBeCloseTo(62.1371, 4);
    expect(mphToKph(60)).toBeCloseTo(96.5606, 4);
  });

  it('round trips exactly as floats', () => {
    expect(mphToKph(kphToMph(80))).toBeCloseTo(80, 10);
  });

  it('uses the exact statute mile factor', () => {
    expect(KPH_PER_MPH).toBe(1.609344);
  });
});

describe('resolveGantryUnits', () => {
  it('follows the sim when set to auto', () => {
    expect(resolveGantryUnits('auto', 1).isMetric).toBe(true);
    expect(resolveGantryUnits('auto', 0).isMetric).toBe(false);
  });

  it('assumes metric when the sim value is unknown', () => {
    expect(resolveGantryUnits('auto', undefined).isMetric).toBe(true);
  });

  it('defaults a missing setting to auto', () => {
    expect(resolveGantryUnits(undefined, 0).isMetric).toBe(false);
    expect(resolveGantryUnits(undefined, 1).isMetric).toBe(true);
  });

  it('overrides the sim when explicitly set', () => {
    expect(resolveGantryUnits('Metric', 0).isMetric).toBe(true);
    expect(resolveGantryUnits('Imperial', 1).isMetric).toBe(false);
  });

  it('exposes the matching unit label and factor', () => {
    const metric = resolveGantryUnits('Metric', undefined);
    expect(metric.speedUnit).toBe('km/h');
    expect(metric.speedFactorFromKph).toBe(1);

    const imperial = resolveGantryUnits('Imperial', undefined);
    expect(imperial.speedUnit).toBe('mph');
    expect(imperial.speedFactorFromKph).toBeCloseTo(1 / KPH_PER_MPH, 10);
    expect(100 * imperial.speedFactorFromKph).toBeCloseTo(62.1371, 4);
  });
});

describe('speedToDisplay / speedFromDisplay', () => {
  it('is a no-op in metric', () => {
    expect(speedToDisplay(15, true)).toBe(15);
    expect(speedFromDisplay(15, true)).toBe(15);
  });

  it('shows whole mph when imperial', () => {
    expect(speedToDisplay(15, false)).toBe(9);
    expect(speedToDisplay(80, false)).toBe(50);
    expect(speedToDisplay(20, false)).toBe(12);
  });

  it('persists km/h when imperial', () => {
    expect(speedFromDisplay(9, false)).toBe(14);
    expect(speedFromDisplay(50, false)).toBe(80);
    expect(speedFromDisplay(12, false)).toBe(19);
  });

  it('never drifts a stored km/h value by more than 1 on a round trip', () => {
    for (let kph = 1; kph <= 400; kph++) {
      const roundTripped = speedFromDisplay(speedToDisplay(kph, false), false);
      expect(Math.abs(roundTripped - kph)).toBeLessThanOrEqual(1);
    }
  });

  it('is stable once round tripped (no repeated drift)', () => {
    for (let kph = 1; kph <= 400; kph++) {
      const once = speedFromDisplay(speedToDisplay(kph, false), false);
      const twice = speedFromDisplay(speedToDisplay(once, false), false);
      expect(twice).toBe(once);
    }
  });
});

describe('speedMinToDisplay / speedMaxToDisplay', () => {
  it('leaves bounds untouched in metric', () => {
    expect(speedMinToDisplay(20, true)).toBe(20);
    expect(speedMaxToDisplay(300, true)).toBe(300);
  });

  it('rounds bounds inward so the imperial range stays valid', () => {
    expect(speedMinToDisplay(1, false)).toBe(1);
    expect(speedMinToDisplay(20, false)).toBe(13);
    expect(speedMaxToDisplay(100, false)).toBe(62);
    expect(speedMaxToDisplay(300, false)).toBe(186);
  });

  it('keeps converted bounds inside the original km/h range', () => {
    const bounds: [number, number][] = [
      [1, 100],
      [20, 300],
      [1, 50],
    ];

    bounds.forEach(([min, max]) => {
      const minKph = speedFromDisplay(speedMinToDisplay(min, false), false);
      const maxKph = speedFromDisplay(speedMaxToDisplay(max, false), false);
      expect(minKph).toBeGreaterThanOrEqual(min);
      expect(maxKph).toBeLessThanOrEqual(max);
    });
  });
});
