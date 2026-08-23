import { describe, expect, it } from 'vitest';
import {
  MAX_GAP_CEILING_SECONDS,
  MAX_GRIDLINES,
  buildGapAxis,
  buildLinearAxis,
  buildPositionAxis,
  formatAxisValue,
  gapAxisStep,
  lapAxisLabels,
  lapLabelCapacity,
  niceStep,
} from './lapGraphScales';

describe('buildGapAxis', () => {
  it('keeps a close field on a fine step', () => {
    const axis = buildGapAxis(12);

    expect(axis.step).toBe(2);
    expect(axis.max).toBe(12);
    expect(axis.values).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  it('never draws more than the gridline cap', () => {
    for (const maxGap of [30, 300, 1800, 3600, 1e6]) {
      expect(buildGapAxis(maxGap).values.length).toBeLessThanOrEqual(
        MAX_GRIDLINES + 1
      );
    }
  });

  it('clamps a garbage sentinel instead of allocating an unbounded axis', () => {
    const axis = buildGapAxis(1e6);

    expect(axis.max).toBeLessThanOrEqual(MAX_GAP_CEILING_SECONDS);
    expect(axis.values.length).toBeLessThanOrEqual(MAX_GRIDLINES + 1);
  });

  it('survives a non-finite maximum', () => {
    const axis = buildGapAxis(Number.NaN);

    expect(Number.isFinite(axis.max)).toBe(true);
    expect(axis.values.length).toBeGreaterThan(0);
  });

  it('keeps a usable axis when every gap is zero', () => {
    const axis = buildGapAxis(0);

    expect(axis.max).toBeGreaterThan(0);
    expect(axis.values[0]).toBe(0);
  });
});

describe('gapAxisStep', () => {
  it('grows the step as the range grows', () => {
    expect(gapAxisStep(8)).toBe(1);
    expect(gapAxisStep(40)).toBe(5);
    expect(gapAxisStep(200)).toBe(30);
    expect(gapAxisStep(600)).toBe(120);
  });
});

describe('lapAxisLabels', () => {
  it('labels every lap for a short race', () => {
    expect(lapAxisLabels(1, 6, 10)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('thins labels so a long race does not smear', () => {
    const labels = lapAxisLabels(1, 500, 20);

    expect(labels.length).toBeLessThanOrEqual(21);
    expect(labels[0]).toBe(1);
    expect(labels[labels.length - 1]).toBe(500);
  });

  it('always includes the last lap', () => {
    const labels = lapAxisLabels(1, 47, 8);

    expect(labels[labels.length - 1]).toBe(47);
  });

  it('handles a single recorded lap', () => {
    expect(lapAxisLabels(3, 3, 10)).toEqual([3]);
  });
});

describe('lapLabelCapacity', () => {
  it('scales with the plot width', () => {
    expect(lapLabelCapacity(1368, 34)).toBe(40);
    expect(lapLabelCapacity(340, 34)).toBe(10);
  });

  it('never drops below two labels, even at zero width', () => {
    expect(lapLabelCapacity(0, 34)).toBe(2);
  });
});

describe('niceStep', () => {
  it('walks the ladder as the range grows', () => {
    expect(niceStep(8)).toBe(1);
    expect(niceStep(80)).toBe(10);
    expect(niceStep(800)).toBe(100);
  });

  it('handles a sub-unit range', () => {
    expect(niceStep(0.4)).toBeCloseTo(0.05, 10);
  });

  it('never returns zero', () => {
    expect(niceStep(0)).toBeGreaterThan(0);
    expect(niceStep(Number.NaN)).toBeGreaterThan(0);
  });
});

describe('buildLinearAxis', () => {
  it('spans a negative-to-positive trace range', () => {
    const axis = buildLinearAxis(-42, 17);

    expect(axis.min).toBeLessThanOrEqual(-42);
    expect(axis.max).toBeGreaterThanOrEqual(17);
    expect(axis.values.length).toBeLessThanOrEqual(MAX_GRIDLINES + 1);
  });

  it('never draws more than the gridline cap', () => {
    for (const [low, high] of [
      [0, 1],
      [-1000, 1000],
      [-1e6, 1e6],
      [0.001, 0.002],
    ] as const) {
      expect(buildLinearAxis(low, high).values.length).toBeLessThanOrEqual(
        MAX_GRIDLINES + 1
      );
    }
  });

  it('pads a flat series instead of returning a zero-height axis', () => {
    const axis = buildLinearAxis(5, 5);

    expect(axis.max).toBeGreaterThan(axis.min);
    expect(axis.values.length).toBeGreaterThan(1);
  });

  it('accepts a reversed range', () => {
    expect(buildLinearAxis(20, -20)).toEqual(buildLinearAxis(-20, 20));
  });

  it('survives non-finite input', () => {
    const axis = buildLinearAxis(Number.NaN, Number.POSITIVE_INFINITY);

    expect(Number.isFinite(axis.min)).toBe(true);
    expect(Number.isFinite(axis.max)).toBe(true);
  });

  it('does not drift on a fractional step', () => {
    const axis = buildLinearAxis(0, 1);

    for (const value of axis.values) {
      expect(Math.abs(value * 100 - Math.round(value * 100))).toBeLessThan(
        1e-6
      );
    }
  });
});

describe('buildPositionAxis', () => {
  it('starts at one and steps by whole positions', () => {
    const axis = buildPositionAxis(12);

    expect(axis.min).toBe(1);
    expect(axis.max).toBe(12);
    expect(axis.values.every((v) => Number.isInteger(v))).toBe(true);
  });

  it('thins a full 60-car field within the gridline cap', () => {
    const axis = buildPositionAxis(60);

    expect(axis.values.length).toBeLessThanOrEqual(MAX_GRIDLINES + 1);
    expect(axis.values[0]).toBe(1);
    expect(axis.values[axis.values.length - 1]).toBe(60);
  });

  it('keeps a usable axis for a two-car class', () => {
    expect(buildPositionAxis(1).max).toBeGreaterThanOrEqual(2);
  });

  it('survives non-finite input', () => {
    expect(Number.isFinite(buildPositionAxis(Number.NaN).max)).toBe(true);
  });
});

describe('formatAxisValue', () => {
  it('writes positions as whole numbers', () => {
    expect(formatAxisValue('position', 7)).toBe('7');
  });

  it('signs a positive time', () => {
    expect(formatAxisValue('trace', 12.5)).toBe('+12.5');
  });

  it('keeps the minus sign on a negative time', () => {
    expect(formatAxisValue('trace', -12.5)).toBe('-12.5');
  });

  it('does not sign zero', () => {
    expect(formatAxisValue('gap', 0)).toBe('0.0');
  });

  it('drops decimals on a large value', () => {
    expect(formatAxisValue('gap', 600)).toBe('+600');
  });
});
