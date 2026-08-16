import { describe, it, expect } from 'vitest';
import type { ReferenceLap } from '@irdashies/types';
import {
  hasCompleteSpeedTrace,
  interpolateSpeedAtPoint,
} from './referenceSpeed';
import { buildMockSpeedLap, mockSpeedAt } from './mockSpeedLap';

/** Narrows away the null case so assertions read cleanly. */
function speedAt(lap: ReferenceLap, pct: number): number {
  const result = interpolateSpeedAtPoint(lap, pct);
  if (result === null) throw new Error(`expected a speed at ${pct}, got null`);
  return result;
}

function speedsOf(lap: ReferenceLap): Float32Array {
  if (!lap.speedsKph) throw new Error('expected a speed trace');
  return lap.speedsKph;
}

/** A single corner right before the line, to exercise the wrap. */
const CORNER_AT_LINE = [{ pct: 0.99, depthKph: 150, width: 0.02 }];

describe('interpolateSpeedAtPoint', () => {
  const lap = buildMockSpeedLap();

  it('returns the recorded speed back at each bucket position', () => {
    // The lap is generated from mockSpeedAt(), so it is exact ground truth.
    for (let i = 0; i < lap.pointsCount; i += 17) {
      const pct = lap.pointPos[i];
      expect(speedAt(lap, pct)).toBeCloseTo(mockSpeedAt(pct), 1);
    }
  });

  it('interpolates between buckets', () => {
    const speeds = speedsOf(lap);
    const mid = (lap.pointPos[100] + lap.pointPos[101]) / 2;
    const result = speedAt(lap, mid);

    expect(result).toBeGreaterThanOrEqual(Math.min(speeds[100], speeds[101]));
    expect(result).toBeLessThanOrEqual(Math.max(speeds[100], speeds[101]));
  });

  it('interpolates across the start/finish line rather than freezing', () => {
    // getBucketIndex clamps rather than wraps, so a naive `targetPct + interval`
    // lookup collapses the second knot onto the first in the final bucket and
    // holds the last recorded speed flat all the way to the line. A corner near
    // the line separates the two bounding speeds enough to tell the two apart.
    const wrapLap = buildMockSpeedLap({ corners: CORNER_AT_LINE });
    const speeds = speedsOf(wrapLap);
    const last = wrapLap.pointsCount - 1;
    const midpoint = wrapLap.pointPos[last] + wrapLap.interval / 2;

    const result = speedAt(wrapLap, midpoint);

    expect(result).toBeCloseTo((speeds[last] + speeds[0]) / 2, 1);
    // Genuinely between the two, not pinned to the near end.
    expect(Math.abs(result - speeds[last])).toBeGreaterThan(1);
  });

  it('stays continuous across the start/finish line', () => {
    const wrapLap = buildMockSpeedLap({ corners: CORNER_AT_LINE });
    const before = speedAt(wrapLap, 0.99999);
    const after = speedAt(wrapLap, 0.00001);

    // Adjacent samples 0.002% of a lap apart must not jump.
    expect(Math.abs(before - after)).toBeLessThan(1);
  });

  it('returns null for a lap with no speed trace', () => {
    const noSpeeds = buildMockSpeedLap({ withoutSpeeds: true });
    expect(interpolateSpeedAtPoint(noSpeeds, 0.5)).toBeNull();
  });

  it('returns null when a bounding bucket was never recorded', () => {
    const gapped = buildMockSpeedLap();
    const idx = 200;
    speedsOf(gapped)[idx] = 0; // the "never recorded" sentinel

    expect(interpolateSpeedAtPoint(gapped, gapped.pointPos[idx])).toBeNull();
  });

  it('never returns a non-finite value across the whole lap', () => {
    for (let pct = 0; pct < 1; pct += 0.001) {
      expect(Number.isFinite(speedAt(lap, pct))).toBe(true);
    }
  });
});

describe('hasCompleteSpeedTrace', () => {
  it('accepts a fully recorded lap', () => {
    expect(hasCompleteSpeedTrace(buildMockSpeedLap())).toBe(true);
  });

  it('rejects a lap with no speed trace at all', () => {
    const noSpeeds = buildMockSpeedLap({ withoutSpeeds: true });
    expect(hasCompleteSpeedTrace(noSpeeds)).toBe(false);
  });

  it('rejects a lap whose speeds start partway round', () => {
    // Recording starts once the player car index is known, so a lap already in
    // progress at that point has leading zeros.
    const partial = buildMockSpeedLap();
    const speeds = speedsOf(partial);
    for (let i = 0; i < 40; i++) speeds[i] = 0;

    expect(hasCompleteSpeedTrace(partial)).toBe(false);
  });

  it('rejects a trace shorter than the lap bucket count', () => {
    // Every entry is a real speed, so a length-agnostic check would call this
    // complete — and then interpolation would return null for every bucket past
    // the end of the trace, blanking the widget across the tail of the lap.
    const short = buildMockSpeedLap();
    const speeds = speedsOf(short);
    (short as { speedsKph?: Float32Array }).speedsKph = speeds.slice(
      0,
      speeds.length - 1
    );

    expect(hasCompleteSpeedTrace(short)).toBe(false);
  });

  it('caches by lap identity', () => {
    const lap = buildMockSpeedLap();
    expect(hasCompleteSpeedTrace(lap)).toBe(true);

    // Mutating after the first call is not observed — acceptable because a
    // promoted lap's speeds never change, and it proves the scan is not
    // repeated on every frame.
    speedsOf(lap)[10] = 0;
    expect(hasCompleteSpeedTrace(lap)).toBe(true);
  });

  it('rejects an empty lap', () => {
    expect(hasCompleteSpeedTrace({} as ReferenceLap)).toBe(false);
  });
});
