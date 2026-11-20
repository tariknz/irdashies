import { describe, it, expect } from 'vitest';
import type { LapTraceSamples } from '@irdashies/types';
import { deriveEvents } from './pedalEvents';
import { SHIFT_SPAN_MAX_SEC, selectThrottlePoints } from './throttlePoints';

/** 60 Hz, and fast enough that a tenth of a second is metres of track. */
const DT_SEC = 1 / 60;
const METRES_PER_SAMPLE = 1;

/**
 * A lap from per-sample throttle and gear traces. Distances are 1 m apart, so
 * a sample index reads directly as a distance in the expectations below.
 */
const lap = (throttle: number[], gear: number[]): LapTraceSamples => {
  const n = throttle.length;
  return {
    length: n,
    distanceM: Float32Array.from(
      { length: n },
      (_, i) => i * METRES_PER_SAMPLE
    ),
    timeSec: Float32Array.from({ length: n }, (_, i) => i * DT_SEC),
    throttle: Float32Array.from(throttle),
    brake: Float32Array.from(throttle.map((t) => (t > 0 ? 0 : 1))),
    speed: Float32Array.from({ length: n }, () => 40),
    gear: Float32Array.from(gear),
    absActive: new Float32Array(n),
  };
};

/** `count` samples of `value`. */
const run = (value: number, count: number) =>
  new Array<number>(count).fill(value);

/** Samples that fit inside SHIFT_SPAN_MAX_SEC, and comfortably outside it. */
const SHORT = Math.floor(SHIFT_SPAN_MAX_SEC / DT_SEC / 2);
const LONG = Math.ceil((SHIFT_SPAN_MAX_SEC / DT_SEC) * 3);

/** What the plot would mark, given the events the tracker records for a lap. */
const pointsFor = (samples: LapTraceSamples) =>
  Array.from(selectThrottlePoints(samples, deriveEvents(samples).throttleOnM));

describe('selectThrottlePoints', () => {
  it('drops the blip of a downshift under braking', () => {
    // Braking in 4th, a short stab of throttle to match revs, then 3rd.
    const throttle = [...run(0, LONG), ...run(0.4, SHORT), ...run(0, LONG)];
    const gear = [
      ...run(4, LONG),
      ...run(4, SHORT),
      // Neutral for the instant between the two gears, as the sim reports it.
      0,
      ...run(3, LONG - 1),
    ];

    expect(deriveEvents(lap(throttle, gear)).throttleOnM).toHaveLength(1);
    expect(pointsFor(lap(throttle, gear))).toEqual([]);
  });

  it('keeps a brief stab of throttle that is not a shift', () => {
    // Identical shape, same gear throughout — a correction mid-corner.
    const throttle = [...run(0, LONG), ...run(0.4, SHORT), ...run(0, LONG)];
    const gear = run(3, throttle.length);

    expect(pointsFor(lap(throttle, gear))).toHaveLength(1);
  });

  it('drops the re-application after an upshift lift', () => {
    // On the power in 3rd, a brief lift to shift, then on again in 4th.
    const throttle = [...run(1, LONG), ...run(0, SHORT), ...run(1, LONG)];
    const gear = [...run(3, LONG), 0, ...run(4, SHORT - 1), ...run(4, LONG)];

    // The lap opens on the throttle, so the tracker records only the
    // re-application — which is the one that should not be marked.
    expect(deriveEvents(lap(throttle, gear)).throttleOnM).toHaveLength(1);
    expect(pointsFor(lap(throttle, gear))).toEqual([]);
  });

  it('keeps a corner exit even when the downshift lands right before it', () => {
    // The braking zone is a long throttle-off span and the throttle stays on
    // afterwards, so neither half of the rule can reach it — however close the
    // shift into the corner sits to the pickup.
    const throttle = [...run(0, LONG), ...run(1, LONG)];
    const gear = [...run(3, LONG - 1), 0, ...run(2, LONG)];

    const points = pointsFor(lap(throttle, gear));
    expect(points).toHaveLength(1);
    // The interpolated crossing, a hair past the last off sample.
    expect(points[0]).toBeCloseTo(LONG - 1, 1);
  });

  it('keeps a lift long enough to be driving, shift or no shift', () => {
    // A proper lift through a fast corner that happens to span a shift is a
    // real throttle application on the way out of it.
    const throttle = [...run(1, LONG), ...run(0, LONG), ...run(1, LONG)];
    const gear = [...run(3, LONG), 0, ...run(4, LONG * 2 - 1)];

    expect(pointsFor(lap(throttle, gear))).toHaveLength(1);
  });

  it('keeps everything for a lap with no gear data', () => {
    // An import whose gear column was blank reads as all-neutral. With nothing
    // to compare, a missing marker would be worse than an artefact.
    const throttle = [...run(0, LONG), ...run(0.4, SHORT), ...run(0, LONG)];

    expect(pointsFor(lap(throttle, run(0, throttle.length)))).toHaveLength(1);
  });

  it('handles an application that never releases before the lap ends', () => {
    const throttle = [...run(0, LONG), ...run(1, SHORT)];
    const gear = [...run(3, LONG), ...run(4, SHORT)];

    expect(pointsFor(lap(throttle, gear))).toHaveLength(1);
  });

  it('returns an empty list when the lap recorded no applications', () => {
    expect(pointsFor(lap(run(0, LONG), run(3, LONG)))).toEqual([]);
  });

  it('keeps every point when there are too few samples to judge them', () => {
    const samples = lap([1], [3]);
    const events = Float32Array.from([0]);
    expect(Array.from(selectThrottlePoints(samples, events))).toEqual([0]);
  });
});
