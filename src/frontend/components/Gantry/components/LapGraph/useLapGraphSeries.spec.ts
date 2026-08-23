import { describe, expect, it } from 'vitest';
import {
  CONTEXT_ALPHA,
  brightenColor,
  buildModeAxis,
  decimateMinMax,
  lapBoundsOf,
  prepareLapGraph,
  strokeStyleFor,
  tierFor,
  valueAtLap,
  valueExtentOf,
  valueToY,
  windowSlice,
  type LapGraphSeries,
  type LapPoint,
} from './useLapGraphSeries';
import { buildLinearAxis } from './lapGraphScales';

const ramp = (laps: number, slope: number, from = 1): LapPoint[] =>
  Array.from({ length: laps }, (_, i) => ({
    lap: from + i,
    value: (from + i) * slope,
  }));

const makeSeries = (
  carIdx: number,
  points: LapPoint[],
  overrides: Partial<LapGraphSeries> = {}
): LapGraphSeries => ({
  carIdx,
  carNumber: String(carIdx),
  displayName: `Driver ${carIdx}`,
  isPlayer: false,
  color: '#22c55e',
  points,
  ...overrides,
});

describe('lapBoundsOf', () => {
  it('spans every series', () => {
    expect(
      lapBoundsOf([makeSeries(1, ramp(10, 1)), makeSeries(2, ramp(4, 1, 20))])
    ).toEqual({ minLap: 1, maxLap: 23 });
  });

  it('falls back to a single lap when nothing is recorded', () => {
    expect(lapBoundsOf([])).toEqual({ minLap: 1, maxLap: 1 });
    expect(lapBoundsOf([makeSeries(1, [])])).toEqual({ minLap: 1, maxLap: 1 });
  });
});

describe('windowSlice', () => {
  const points = ramp(100, 1);

  it('keeps one point outside each edge so the line reaches the border', () => {
    const sliced = windowSlice(points, { start: 40, end: 50 });

    expect(sliced[0].lap).toBe(39);
    expect(sliced[sliced.length - 1].lap).toBe(51);
  });

  it('returns the original array when the window covers everything', () => {
    expect(windowSlice(points, { start: 1, end: 100 })).toBe(points);
  });

  it('handles an empty series', () => {
    expect(windowSlice([], { start: 1, end: 10 })).toEqual([]);
  });
});

describe('decimateMinMax', () => {
  it('leaves a series alone when it already fits the columns', () => {
    const points = ramp(50, 1);

    expect(decimateMinMax(points, 500)).toBe(points);
  });

  it('caps output at roughly two points per column', () => {
    const decimated = decimateMinMax(ramp(5000, 1), 200);

    expect(decimated.length).toBeLessThanOrEqual(200 * 2 + 2);
  });

  it('keeps a one-lap outlier spike that stride sampling would drop', () => {
    const points: LapPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      lap: i + 1,
      value: 0,
    }));
    // Lap 504 sits between every stride-10 sample, so naive sampling misses it.
    points[503] = { lap: 504, value: 600 };

    const columns = 100;
    const stride = points.filter((_, i) => i % (points.length / columns) === 0);
    expect(stride.some((p) => p.value === 600)).toBe(false);

    const decimated = decimateMinMax(points, columns);
    expect(decimated.some((p) => p.lap === 504 && p.value === 600)).toBe(true);
  });

  it('keeps a downward spike too', () => {
    const points: LapPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      lap: i + 1,
      value: 10,
    }));
    points[777] = { lap: 778, value: -99 };

    expect(decimateMinMax(points, 120).some((p) => p.value === -99)).toBe(true);
  });

  it('keeps both ends of the series', () => {
    const points = ramp(2000, 0.5);
    const decimated = decimateMinMax(points, 90);

    expect(decimated[0]).toBe(points[0]);
    expect(decimated[decimated.length - 1]).toBe(points[points.length - 1]);
  });

  it('stays in lap order', () => {
    const points: LapPoint[] = Array.from({ length: 3000 }, (_, i) => ({
      lap: i + 1,
      value: Math.sin(i / 7) * 100,
    }));
    const decimated = decimateMinMax(points, 250);

    for (let i = 1; i < decimated.length; i++) {
      expect(decimated[i].lap).toBeGreaterThanOrEqual(decimated[i - 1].lap);
    }
  });

  it('survives a zero-width plot', () => {
    expect(decimateMinMax(ramp(10, 1), 0)).toHaveLength(1);
    expect(decimateMinMax([], 0)).toEqual([]);
  });
});

describe('valueExtentOf', () => {
  it('spans every windowed series', () => {
    expect(valueExtentOf([ramp(5, 1), ramp(5, -3)])).toEqual({
      min: -15,
      max: 5,
    });
  });

  it('ignores non-finite values', () => {
    expect(
      valueExtentOf([
        [
          { lap: 1, value: Number.NaN },
          { lap: 2, value: 4 },
        ],
      ])
    ).toEqual({ min: 4, max: 4 });
  });

  it('falls back to a usable extent when there is nothing to measure', () => {
    expect(valueExtentOf([])).toEqual({ min: 0, max: 1 });
  });
});

describe('buildModeAxis', () => {
  it('uses a signed linear axis for trace', () => {
    expect(buildModeAxis('trace', { min: -30, max: 12 })).toEqual(
      buildLinearAxis(-30, 12)
    );
  });

  it('starts a position axis at one', () => {
    expect(buildModeAxis('position', { min: 1, max: 24 }).min).toBe(1);
  });

  it('starts a gap axis at zero and clamps a garbage maximum', () => {
    const axis = buildModeAxis('gap', { min: 0, max: 1e6 });

    expect(axis.min).toBe(0);
    expect(axis.max).toBeLessThanOrEqual(600);
  });
});

describe('buildModeAxis gap mode with a car ahead of the leader', () => {
  it('keeps negative gaps on the axis', () => {
    // gapToClassLeader signs the value, and the axis caption promises that
    // below zero reads as ahead of the class leader.
    const axis = buildModeAxis('gap', { min: -4.2, max: 30 });

    expect(axis.min).toBeLessThanOrEqual(-4.2);
    expect(axis.max).toBeGreaterThanOrEqual(30);
  });

  it('still uses the gap stepping when the whole field is behind', () => {
    const axis = buildModeAxis('gap', { min: 0, max: 30 });

    expect(axis.min).toBe(0);
  });
});

describe('valueToY', () => {
  const axis = buildLinearAxis(0, 100);

  it('puts the maximum at the top for a normal axis', () => {
    expect(valueToY(axis.max, axis, 400, false)).toBe(0);
    expect(valueToY(axis.min, axis, 400, false)).toBe(400);
  });

  it('puts position one at the top when inverted', () => {
    const position = buildModeAxis('position', { min: 1, max: 20 });

    expect(valueToY(1, position, 400, true)).toBe(0);
    expect(valueToY(position.max, position, 400, true)).toBe(400);
  });

  it('centres instead of dividing by zero', () => {
    expect(
      valueToY(5, { min: 3, max: 3, step: 1, values: [3] }, 400, false)
    ).toBe(200);
  });
});

describe('emphasis tiers', () => {
  const pinned = new Set([7]);

  it('focus beats a pin', () => {
    expect(tierFor(makeSeries(7, []), pinned, 7)).toBe('focus');
  });

  it('pins the explicit set', () => {
    expect(tierFor(makeSeries(7, []), pinned, null)).toBe('pinned');
  });

  it('never leaves the player in the context wash', () => {
    expect(tierFor(makeSeries(9, [], { isPlayer: true }), pinned, null)).toBe(
      'pinned'
    );
  });

  it('everything else is context', () => {
    expect(tierFor(makeSeries(9, []), pinned, null)).toBe('context');
  });

  it('gives each tier a distinct weight', () => {
    expect(strokeStyleFor('context', '#22c55e')).toEqual({
      color: '#22c55e',
      width: 1,
      alpha: CONTEXT_ALPHA,
    });
    expect(strokeStyleFor('pinned', '#22c55e').width).toBe(2);
    expect(strokeStyleFor('focus', '#22c55e').width).toBe(3);
  });

  it('brightens only the focus tier', () => {
    expect(strokeStyleFor('focus', '#22c55e').color).not.toBe('#22c55e');
    expect(strokeStyleFor('pinned', '#22c55e').color).toBe('#22c55e');
  });
});

describe('brightenColor', () => {
  it('lifts a long hex towards white', () => {
    expect(brightenColor('#000000', 0.5)).toBe('#808080');
  });

  it('expands a short hex', () => {
    expect(brightenColor('#000', 0.5)).toBe('#808080');
  });

  it('passes an unparseable colour through', () => {
    expect(brightenColor('oklch(0.7 0.1 200)')).toBe('oklch(0.7 0.1 200)');
  });

  it('never overflows white', () => {
    expect(brightenColor('#ffffff', 1)).toBe('#ffffff');
  });
});

describe('valueAtLap', () => {
  const points = ramp(20, 2);

  it('finds an exact lap', () => {
    expect(valueAtLap(points, 7)).toBe(14);
  });

  it('returns null for a lap the car has no record of', () => {
    expect(valueAtLap(points, 99)).toBeNull();
    expect(valueAtLap([], 3)).toBeNull();
  });

  it('returns null for a gap in the record', () => {
    expect(
      valueAtLap(
        [
          { lap: 1, value: 1 },
          { lap: 4, value: 4 },
        ],
        2
      )
    ).toBeNull();
  });
});

describe('prepareLapGraph', () => {
  const field: LapGraphSeries[] = Array.from({ length: 60 }, (_, i) =>
    makeSeries(i, ramp(500, 0.02 + (i % 12) * 0.015), {
      isPlayer: i === 3,
    })
  );

  it('draws context first and focus last', () => {
    const geometry = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 1, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [10, 11],
      focusedCarIdx: 20,
    });

    const tiers = geometry.ordered.map((s) => s.tier);
    expect(tiers[tiers.length - 1]).toBe('focus');
    expect(tiers.indexOf('pinned')).toBeGreaterThan(
      tiers.lastIndexOf('context')
    );
  });

  it('counts the context cars for the legend', () => {
    const geometry = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 1, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [10, 11],
      focusedCarIdx: 20,
    });

    // 60 cars less two pins, one focus and the player.
    expect(geometry.contextCount).toBe(56);
  });

  it('clamps a window the caller pushed past the data', () => {
    const geometry = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 900, end: 1200 },
      plotWidth: 1368,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });

    expect(geometry.window.end).toBe(500);
  });

  it('cuts the drawn points down hard for a narrow plot', () => {
    const wide = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 1, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });
    const narrow = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 1, end: 500 },
      plotWidth: 120,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });

    expect(wide.drawnPointCount).toBe(60 * 500);
    expect(narrow.drawnPointCount).toBeLessThan(60 * 500);
    expect(narrow.drawnPointCount).toBeLessThanOrEqual(60 * (120 * 2 + 2));
  });

  it('windowing shrinks the work without changing the recorded bounds', () => {
    const geometry = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 425, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });

    expect(geometry.bounds).toEqual({ minLap: 1, maxLap: 500 });
    expect(geometry.drawnPointCount).toBeLessThan(60 * 100);
  });

  it('inverts only in position mode', () => {
    const base = {
      series: field,
      window: { start: 1, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    };

    expect(prepareLapGraph({ ...base, mode: 'position' }).inverted).toBe(true);
    expect(prepareLapGraph({ ...base, mode: 'trace' }).inverted).toBe(false);
    expect(prepareLapGraph({ ...base, mode: 'gap' }).inverted).toBe(false);
  });

  it('keeps a lookup for pointer hit testing', () => {
    const geometry = prepareLapGraph({
      series: field,
      mode: 'trace',
      window: { start: 400, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });

    // The lookup holds the full record, not the windowed copy.
    expect(geometry.byCarIdx.get(3)?.points).toHaveLength(500);
  });

  it('handles an empty field', () => {
    const geometry = prepareLapGraph({
      series: [],
      mode: 'trace',
      window: { start: 1, end: 10 },
      plotWidth: 800,
      pinnedCarIdxs: [],
      focusedCarIdx: null,
    });

    expect(geometry.ordered).toEqual([]);
    expect(Number.isFinite(geometry.axis.max)).toBe(true);
  });

  it('keeps a pit-stop step on the axis instead of clipping it', () => {
    const pitted = makeSeries(
      17,
      ramp(500, 0.02).map((p) =>
        p.lap > 250 ? { lap: p.lap, value: p.value - 600 } : p
      )
    );
    const geometry = prepareLapGraph({
      series: [...field, pitted],
      mode: 'trace',
      window: { start: 1, end: 500 },
      plotWidth: 1368,
      pinnedCarIdxs: [17],
      focusedCarIdx: null,
    });

    expect(geometry.axis.min).toBeLessThanOrEqual(-590);
  });
});
