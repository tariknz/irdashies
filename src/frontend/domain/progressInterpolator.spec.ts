import { describe, expect, it } from 'vitest';
import { ProgressInterpolator } from './progressInterpolator';

describe('ProgressInterpolator', () => {
  it('interpolates normal movement', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.1 }], 0);
    interpolator.setTargets([{ progress: 0.3 }], 0);

    expect(interpolator.advance(20)).toBe(true);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.2);
  });

  it('uses the shortest wrapped path across start/finish', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.99 }], 0);
    interpolator.setTargets([{ progress: 0.01 }], 0);

    interpolator.advance(20);
    expect(interpolator.getValues()[0]).toBeCloseTo(0);
    interpolator.advance(40);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.01);
  });

  it('settles after one position interval', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.2 }], 0);
    interpolator.setTargets([{ progress: 0.4 }], 0);

    expect(interpolator.advance(39)).toBe(true);
    expect(interpolator.advance(40)).toBe(false);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.4);
  });

  it('adapts interpolation to the observed snapshot cadence', () => {
    const interpolator = new ProgressInterpolator();
    interpolator.setTargets([{ progress: 0.1 }], 0);
    interpolator.setTargets([{ progress: 0.3 }], 50);

    expect(interpolator.advance(75)).toBe(true);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.2);
    expect(interpolator.advance(100)).toBe(false);
  });

  it('reuses its output collection throughout the frame path', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.1 }, { progress: 0.2 }], 0);
    const output = interpolator.getValues();

    for (let now = 0; now <= 40; now++) {
      interpolator.advance(now);
      expect(interpolator.getValues()).toBe(output);
    }
  });

  it('preserves existing drivers by CarIdx when the roster changes', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets(
      [
        { progress: 0.1, driver: { CarIdx: 7 } },
        { progress: 0.5, driver: { CarIdx: 3 } },
      ],
      0
    );
    interpolator.setTargets(
      [
        { progress: 0.7, driver: { CarIdx: 3 } },
        { progress: 0.9, driver: { CarIdx: 9 } },
      ],
      0
    );

    expect(interpolator.getValues()[0]).toBeCloseTo(0.5);
    expect(interpolator.getValues()[1]).toBeCloseTo(0.9);
    expect(interpolator.getCount()).toBe(2);
  });
});
