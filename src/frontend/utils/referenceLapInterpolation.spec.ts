import { describe, it, expect, vi } from 'vitest';
import type { ReferenceLap } from '@irdashies/types';
import { interpolateAtPoint } from './referenceLapInterpolation';

vi.mock('@irdashies/utils/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A reference lap where elapsed time rises linearly with track position. */
const lap = (points = 400, lapTime = 100): ReferenceLap => {
  const interval = 1 / points;
  const times = new Float32Array(points);
  const pointPos = new Float32Array(points);
  const tangents = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    times[i] = i * interval * lapTime;
    pointPos[i] = i * interval;
    tangents[i] = lapTime;
  }
  return {
    startTime: 0,
    finishTime: lapTime,
    times,
    pointPos,
    tangents,
    interval,
    pointsCount: points,
    lastTrackedPct: 1,
    isCleanLap: true,
  } as ReferenceLap;
};

/** Sparse arrays stand in for a lap that was only partly recorded. */
const partialLap = (): ReferenceLap =>
  ({
    startTime: 0,
    finishTime: 100,
    times: [] as unknown as Float32Array,
    pointPos: [] as unknown as Float32Array,
    tangents: [] as unknown as Float32Array,
    interval: 1 / 400,
    pointsCount: 400,
    lastTrackedPct: 1,
    isCleanLap: true,
  }) as ReferenceLap;

describe('interpolateAtPoint', () => {
  it('reads the start of the lap as no elapsed time', () => {
    expect(interpolateAtPoint(lap(), 0)).toBeCloseTo(0, 3);
  });

  it('interpolates a position between two grid points', () => {
    expect(interpolateAtPoint(lap(), 0.25)).toBeCloseTo(25, 1);
    expect(interpolateAtPoint(lap(), 0.5)).toBeCloseTo(50, 1);
  });

  it('increases monotonically around the lap', () => {
    const reference = lap();
    let previous = -Infinity;
    for (let pct = 0; pct < 1; pct += 0.05) {
      const value = interpolateAtPoint(reference, pct);
      expect(value).not.toBeNull();
      expect(value as number).toBeGreaterThan(previous);
      previous = value as number;
    }
  });

  it('resolves a point that is not exactly on the grid', () => {
    const reference = lap();
    const offGrid = interpolateAtPoint(
      reference,
      0.25 + reference.interval / 3
    );
    const onGrid = interpolateAtPoint(reference, 0.25);

    expect(offGrid).not.toBeNull();
    expect(offGrid as number).toBeGreaterThan(onGrid as number);
  });

  it('returns null when the lap has no data at that point', () => {
    // A reference lap can be partly recorded — an out lap, or a session joined
    // late. Interpolating into the gap must not produce a confident number.
    expect(interpolateAtPoint(partialLap(), 0.5)).toBeNull();
  });

  it('returns null when tangents are missing', () => {
    const reference = lap();
    const withoutTangents = {
      ...reference,
      tangents: [] as unknown as Float32Array,
    } as ReferenceLap;

    expect(interpolateAtPoint(withoutTangents, 0.5)).toBeNull();
  });

  it('falls back to the earlier point when only the later one is missing', () => {
    const reference = lap();
    const truncated = {
      ...reference,
      // Drop everything past the half way mark, as a lap abandoned mid-way
      // would leave it.
      times: reference.times.slice(0, 201),
      pointPos: reference.pointPos.slice(0, 201),
    } as ReferenceLap;

    const value = interpolateAtPoint(truncated, 0.5);

    expect(value).not.toBeNull();
    expect(value as number).toBeCloseTo(50, 0);
  });
});
