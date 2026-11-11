import { describe, it, expect } from 'vitest';
import { VIEW_WIDTH, carXForWindow, xForMetres } from './lapTraceWindow';

const METERS_BEHIND = 200;
const METERS_AHEAD = 200;

describe('xForMetres', () => {
  it('pins the car to the centre of the plot when the split is even', () => {
    expect(xForMetres(1234, 1234, METERS_BEHIND, METERS_AHEAD)).toBe(
      VIEW_WIDTH / 2
    );
    expect(xForMetres(0, 0, METERS_BEHIND, METERS_AHEAD)).toBe(VIEW_WIDTH / 2);
  });

  it('places the window edges at the plot edges', () => {
    expect(
      xForMetres(1000 - METERS_BEHIND, 1000, METERS_BEHIND, METERS_AHEAD)
    ).toBe(0);
    expect(
      xForMetres(1000 + METERS_AHEAD, 1000, METERS_BEHIND, METERS_AHEAD)
    ).toBe(VIEW_WIDTH);
  });

  it('shifts the car away from the midpoint when the split is uneven', () => {
    // 100 m behind, 600 m ahead: the car sits at 100/700 of the width.
    const x = xForMetres(1000, 1000, 100, 600);
    expect(x).toBeCloseTo((100 / 700) * VIEW_WIDTH, 5);
    expect(x).toBeLessThan(VIEW_WIDTH / 2);
  });

  it('does not divide by zero before the window size is known', () => {
    expect(xForMetres(100, 0, 0, 0)).toBe(VIEW_WIDTH / 2);
  });
});

describe('carXForWindow', () => {
  it('centres the car when behind equals ahead', () => {
    expect(carXForWindow(200, 200)).toBe(VIEW_WIDTH / 2);
  });

  it('moves the car toward the smaller side', () => {
    expect(carXForWindow(100, 600)).toBeCloseTo((100 / 700) * VIEW_WIDTH, 5);
    expect(carXForWindow(600, 100)).toBeCloseTo((600 / 700) * VIEW_WIDTH, 5);
  });

  it('does not divide by zero before the window size is known', () => {
    expect(carXForWindow(0, 0)).toBe(VIEW_WIDTH / 2);
  });
});
