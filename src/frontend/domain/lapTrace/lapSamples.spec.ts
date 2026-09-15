import { describe, expect, it } from 'vitest';
import { MAX_LAP_SAMPLES, type LapTraceSamples } from '@irdashies/types';
import {
  INITIAL_SAMPLE_CAPACITY,
  MAX_SAMPLE_GAP_M,
  SampleBuffer,
  indexAtOrBefore,
  minOver,
  normalisePct,
  sampleRange,
  samplesCover,
  scaleDistances,
  timeAtDistance,
  valueAtDistance,
} from './lapSamples';

/** Samples at the given distances; other fields derived so they're testable. */
const lapAt = (distances: number[], speeds?: number[]): LapTraceSamples => {
  const buffer = new SampleBuffer(8);
  distances.forEach((d, i) => {
    buffer.push(d, d / 10, 0.5, 0.25, speeds?.[i] ?? 40, 3, 0);
  });
  return buffer;
};

describe('normalisePct', () => {
  it('wraps into [0, 1)', () => {
    expect(normalisePct(0.25)).toBe(0.25);
    expect(normalisePct(1.25)).toBeCloseTo(0.25, 10);
    expect(normalisePct(-0.25)).toBeCloseTo(0.75, 10);
    expect(normalisePct(1)).toBe(0);
  });
});

describe('SampleBuffer', () => {
  it('stores samples in order and reports the newest distance', () => {
    const buffer = new SampleBuffer();
    expect(buffer.lastDistanceM()).toBe(-1);
    expect(buffer.push(10, 0, 1, 0, 50, 4, 0)).toBe('ok');
    expect(buffer.push(11, 0.02, 0.9, 0.1, 49, 4, 1)).toBe('ok');
    expect(buffer.length).toBe(2);
    expect(buffer.lastDistanceM()).toBe(11);
    expect(buffer.throttle[1]).toBeCloseTo(0.9, 6);
    expect(buffer.absActive[1]).toBe(1);
  });

  it('drops a sample that does not advance and a small wobble back', () => {
    const buffer = new SampleBuffer();
    buffer.push(10, 0, 0, 0, 0, 0, 0);
    expect(buffer.push(10, 0.02, 0, 0, 0, 0, 0)).toBe('dropped');
    expect(buffer.push(10.005, 0.04, 0, 0, 0, 0, 0)).toBe('dropped');
    expect(buffer.push(8, 0.06, 0, 0, 0, 0, 0)).toBe('dropped');
    expect(buffer.length).toBe(1);
  });

  it('flags a spin as backward and a teleport as a gap', () => {
    const buffer = new SampleBuffer();
    buffer.push(100, 0, 0, 0, 0, 0, 0);
    expect(buffer.push(90, 1, 0, 0, 0, 0, 0)).toBe('backward');
    expect(buffer.length).toBe(1);
    expect(buffer.push(100 + MAX_SAMPLE_GAP_M + 1, 2, 0, 0, 0, 0, 0)).toBe(
      'gap'
    );
    // The gap sample is kept so the trace shows where the car reappeared.
    expect(buffer.length).toBe(2);
  });

  it('drops non-finite input rather than poisoning the axis', () => {
    const buffer = new SampleBuffer();
    expect(buffer.push(Number.NaN, 0, 0, 0, 0, 0, 0)).toBe('dropped');
    expect(buffer.push(1, Number.POSITIVE_INFINITY, 0, 0, 0, 0, 0)).toBe(
      'dropped'
    );
    expect(buffer.length).toBe(0);
  });

  it('grows by doubling and keeps earlier samples intact', () => {
    const buffer = new SampleBuffer(2);
    for (let i = 0; i < 5; i++) buffer.push(i, i, i / 10, 0, 0, 0, 0);
    expect(buffer.length).toBe(5);
    expect(buffer.distanceM.length).toBe(8);
    expect(Array.from(buffer.throttle.slice(0, 5))).toEqual(
      [0, 0.1, 0.2, 0.3, 0.4].map((v) => Math.fround(v))
    );
  });

  it('refuses to grow past the cap', () => {
    const buffer = new SampleBuffer(INITIAL_SAMPLE_CAPACITY);
    // Fill to the cap with 1 m steps — MAX_LAP_SAMPLES is small enough to
    // do this directly.
    for (let i = 0; i < MAX_LAP_SAMPLES; i++) {
      buffer.push(i, i, 0, 0, 0, 0, 0);
    }
    expect(buffer.length).toBe(MAX_LAP_SAMPLES);
    expect(buffer.push(MAX_LAP_SAMPLES, 1, 0, 0, 0, 0, 0)).toBe('full');
    expect(buffer.length).toBe(MAX_LAP_SAMPLES);
  });

  it('resets in place without reallocating', () => {
    const buffer = new SampleBuffer(4);
    buffer.push(0, 0, 0, 0, 0, 0, 0);
    const arrays = buffer.distanceM;
    buffer.reset();
    expect(buffer.length).toBe(0);
    expect(buffer.lastDistanceM()).toBe(-1);
    expect(buffer.distanceM).toBe(arrays);
  });

  it('snapshots exact-length copies that outlive a reset', () => {
    const buffer = new SampleBuffer(4);
    buffer.push(0, 0, 1, 0, 40, 3, 0);
    buffer.push(5, 0.1, 0.5, 0.5, 30, 2, 1);
    const record = buffer.toRecordSamples();
    expect(record.length).toBe(2);
    expect(record.distanceM.length).toBe(2);
    buffer.reset();
    buffer.push(99, 0, 0, 0, 0, 0, 0);
    expect(Array.from(record.distanceM)).toEqual([0, 5]);
    expect(record.brake[1]).toBe(0.5);
  });
});

describe('SampleBuffer.copyTailInto', () => {
  const lapEndingAt = (end: number, step = 10) => {
    const buffer = new SampleBuffer(64);
    for (let d = 0; d <= end; d += step) {
      buffer.push(d, d / 10, d / end, 0, 40, 4, d > end - 30 ? 1 : 0);
    }
    return buffer;
  };

  it('keeps only the last stretch of the lap', () => {
    const lap = lapEndingAt(500);
    const tail = new SampleBuffer(8);

    lap.copyTailInto(tail, 100);

    expect(tail.lastDistanceM()).toBe(500);
    // One sample before the 400 m cut, so the line enters from the edge of
    // the window rather than starting inside it.
    expect(tail.distanceM[0]).toBeLessThanOrEqual(400);
    expect(tail.distanceM[1]).toBeGreaterThan(390);
    expect(tail.length).toBeLessThan(lap.length);
  });

  it('carries every channel, not just position', () => {
    const lap = lapEndingAt(500);
    const tail = new SampleBuffer(8);

    lap.copyTailInto(tail, 100);

    const last = tail.length - 1;
    expect(tail.timeSec[last]).toBeCloseTo(50, 6);
    expect(tail.throttle[last]).toBeCloseTo(1, 6);
    expect(tail.speed[last]).toBe(40);
    expect(tail.gear[last]).toBe(4);
    expect(tail.absActive[last]).toBe(1);
  });

  it('copies rather than aliasing, so the source can be rewound', () => {
    const lap = lapEndingAt(500);
    const tail = new SampleBuffer(8);

    lap.copyTailInto(tail, 100);
    const before = tail.lastDistanceM();
    // Exactly what the recorder does at the line, then overwrites.
    lap.reset();
    lap.push(1, 0, 0, 0, 40, 4, 0);

    expect(tail.lastDistanceM()).toBe(before);
    expect(tail.length).toBeGreaterThan(1);
  });

  it('replaces whatever the target held before', () => {
    const tail = new SampleBuffer(8);
    lapEndingAt(500).copyTailInto(tail, 100);
    const firstLength = tail.length;

    lapEndingAt(200).copyTailInto(tail, 100);

    expect(tail.lastDistanceM()).toBe(200);
    expect(tail.length).toBeLessThan(firstLength + 1);
  });

  it('empties the target for an empty lap or a zero budget', () => {
    const tail = new SampleBuffer(8);
    lapEndingAt(500).copyTailInto(tail, 100);

    new SampleBuffer(8).copyTailInto(tail, 100);
    expect(tail.length).toBe(0);

    lapEndingAt(500).copyTailInto(tail, 100);
    lapEndingAt(500).copyTailInto(tail, 0);
    expect(tail.length).toBe(0);
  });

  it('keeps the whole lap when it is shorter than the budget', () => {
    const lap = lapEndingAt(50);
    const tail = new SampleBuffer(8);

    lap.copyTailInto(tail, 600);

    expect(tail.length).toBe(lap.length);
    expect(tail.distanceM[0]).toBe(0);
  });
});

describe('indexAtOrBefore', () => {
  const lap = lapAt([0, 10, 20, 30]);

  it('finds exact hits, in-between positions and the ends', () => {
    expect(indexAtOrBefore(lap, 0)).toBe(0);
    expect(indexAtOrBefore(lap, 10)).toBe(1);
    expect(indexAtOrBefore(lap, 14)).toBe(1);
    expect(indexAtOrBefore(lap, 30)).toBe(3);
    expect(indexAtOrBefore(lap, 999)).toBe(3);
  });

  it('returns -1 before the first sample and on an empty lap', () => {
    expect(indexAtOrBefore(lap, -1)).toBe(-1);
    expect(indexAtOrBefore(new SampleBuffer(2), 5)).toBe(-1);
  });

  it('only searches the first `length` entries of an over-allocated buffer', () => {
    const buffer = new SampleBuffer(8);
    buffer.push(0, 0, 0, 0, 0, 0, 0);
    buffer.push(10, 1, 0, 0, 0, 0, 0);
    // Stale data beyond `length` from a previous lap must be invisible.
    buffer.distanceM[2] = 5;
    expect(indexAtOrBefore(buffer, 7)).toBe(0);
  });
});

describe('valueAtDistance / timeAtDistance', () => {
  const lap = lapAt([0, 10, 20], [40, 20, 60]);

  it('interpolates linearly between samples', () => {
    expect(valueAtDistance(lap, lap.speed, 5)).toBeCloseTo(30, 6);
    expect(valueAtDistance(lap, lap.speed, 15)).toBeCloseTo(40, 6);
    expect(timeAtDistance(lap, 5)).toBeCloseTo(0.5, 6);
  });

  it('returns the sample value on an exact hit and at the last sample', () => {
    expect(valueAtDistance(lap, lap.speed, 10)).toBe(20);
    expect(valueAtDistance(lap, lap.speed, 20)).toBe(60);
  });

  it('is NaN outside the driven range, never a guess', () => {
    expect(valueAtDistance(lap, lap.speed, -0.1)).toBeNaN();
    expect(valueAtDistance(lap, lap.speed, 20.1)).toBeNaN();
    expect(valueAtDistance(new SampleBuffer(2), lap.speed, 0)).toBeNaN();
  });
});

describe('minOver', () => {
  const lap = lapAt([0, 10, 20, 30, 40], [50, 30, 10, 30, 50]);

  it('includes the interior samples', () => {
    expect(minOver(lap, lap.speed, 0, 40)).toBe(10);
  });

  it('includes the interpolated boundaries, not just samples', () => {
    // From 25 m to 35 m: interior sample at 30 (30 m/s); the boundary at
    // 25 m interpolates to 20 m/s and is the true minimum.
    expect(minOver(lap, lap.speed, 25, 35)).toBeCloseTo(20, 6);
  });

  it('is NaN when a boundary is outside the lap or the range is inverted', () => {
    expect(minOver(lap, lap.speed, -5, 10)).toBeNaN();
    expect(minOver(lap, lap.speed, 10, 5)).toBeNaN();
  });
});

describe('samplesCover', () => {
  it('is true across a continuous stretch and false past either end', () => {
    const lap = lapAt([0, 10, 20, 30]);
    expect(samplesCover(lap, 5, 25)).toBe(true);
    expect(samplesCover(lap, 0, 30)).toBe(true);
    expect(samplesCover(lap, -1, 10)).toBe(false);
    expect(samplesCover(lap, 10, 31)).toBe(false);
  });

  it('is false across a gap wider than the tolerance', () => {
    const lap = lapAt([0, 10, 10 + MAX_SAMPLE_GAP_M + 1, 100]);
    expect(samplesCover(lap, 5, 80)).toBe(false);
    // A range that stops before the gap is fine.
    expect(samplesCover(lap, 0, 10)).toBe(true);
    // A tighter tolerance catches a 10 m step.
    expect(samplesCover(lap, 0, 10, 5)).toBe(false);
  });

  it('needs at least two samples', () => {
    expect(samplesCover(lapAt([5]), 5, 5)).toBe(false);
  });
});

describe('sampleRange', () => {
  const lap = lapAt([0, 10, 20, 30]);

  it('returns the inclusive index span inside the distance range', () => {
    expect(sampleRange(lap, 5, 25)).toEqual({ start: 1, end: 2 });
    expect(sampleRange(lap, 10, 20)).toEqual({ start: 1, end: 2 });
    expect(sampleRange(lap, -5, 100)).toEqual({ start: 0, end: 3 });
  });

  it('returns null when no sample falls inside', () => {
    expect(sampleRange(lap, 11, 19)).toBeNull();
    expect(sampleRange(lap, 40, 50)).toBeNull();
    expect(sampleRange(lap, 20, 10)).toBeNull();
  });
});

describe('scaleDistances', () => {
  it('scales only the distance axis and trims to length', () => {
    const buffer = new SampleBuffer(8);
    buffer.push(0, 0, 1, 0, 40, 3, 0);
    buffer.push(100, 2, 0, 1, 20, 2, 1);
    const scaled = scaleDistances(buffer, 1.01);
    expect(scaled.length).toBe(2);
    expect(scaled.distanceM.length).toBe(2);
    expect(scaled.distanceM[1]).toBeCloseTo(101, 4);
    expect(scaled.timeSec[1]).toBe(2);
    expect(scaled.speed[1]).toBe(20);
  });
});
