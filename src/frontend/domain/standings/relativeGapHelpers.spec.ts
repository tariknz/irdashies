import { describe, it, expect } from 'vitest';
import type { ReferenceLap } from '@irdashies/types';
import {
  getStats,
  calculateClassEstimatedDelta,
  calculateClassEstimatedGap,
  getTimeAtPosition,
  calculateReferenceDelta,
  calculateReferenceGap,
} from './relativeGapHelpers';
import type { Standings } from './createStandings';

/** A reference lap where time advances linearly with track position. */
const linearLap = (lapTime: number, points = 400): ReferenceLap => {
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
    startTime: 1000,
    finishTime: 1000 + lapTime,
    times,
    pointPos,
    tangents,
    interval,
    pointsCount: points,
    lastTrackedPct: 1,
    isCleanLap: true,
  } as ReferenceLap;
};

const driverInClass = (estLapTime: number) =>
  ({ carClass: { estLapTime } }) as Standings;

describe('getStats', () => {
  it('takes the class lap time from the driver', () => {
    expect(getStats(12.5, driverInClass(105))).toEqual({
      estTime: 12.5,
      classEstTime: 105,
    });
  });

  it('falls back to a nominal lap time when the driver is unknown', () => {
    // Without this a missing driver would divide by undefined and poison every
    // gap on the row.
    expect(getStats(12.5, undefined)).toEqual({
      estTime: 12.5,
      classEstTime: 90,
    });
  });
});

describe('calculateClassEstimatedDelta', () => {
  const gtp = { estTime: 30, classEstTime: 100 };
  const gt3 = { estTime: 20, classEstTime: 120 };

  it('is positive for the car ahead', () => {
    const delta = calculateClassEstimatedDelta(gtp, gt3, true);

    expect(delta).toBeGreaterThan(0);
  });

  it('is negative for the car behind', () => {
    const delta = calculateClassEstimatedDelta(gtp, gt3, false);

    expect(delta).toBeLessThan(0);
  });

  it('scales the car ahead into the chasing class', () => {
    // The chasing car is the ruler: a slower class chasing a faster one sees a
    // larger gap than the raw time difference, because it will take longer to
    // cover the same ground.
    const slowChaser = calculateClassEstimatedDelta(
      { estTime: 30, classEstTime: 100 },
      { estTime: 20, classEstTime: 120 },
      true
    );
    const sameClass = calculateClassEstimatedDelta(
      { estTime: 30, classEstTime: 100 },
      { estTime: 20, classEstTime: 100 },
      true
    );

    expect(slowChaser).toBeGreaterThan(sameClass);
  });

  it('wraps when the car ahead has actually lapped the car behind', () => {
    // Ahead is just past the line, behind is near the end of the lap, so the
    // raw difference is a large negative that has to wrap forward.
    const delta = calculateClassEstimatedDelta(
      { estTime: 2, classEstTime: 100 },
      { estTime: 95, classEstTime: 100 },
      true
    );

    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeCloseTo(7, 5);
  });

  it('wraps the other way when asking for the car behind', () => {
    // Same pair as above, asked from the other side: the answer is the same
    // seven seconds, signed negative because the target is behind.
    const delta = calculateClassEstimatedDelta(
      { estTime: 2, classEstTime: 100 },
      { estTime: 95, classEstTime: 100 },
      false
    );

    expect(delta).toBeLessThan(0);
    expect(delta).toBeCloseTo(-7, 5);
  });
});

describe('calculateClassEstimatedGap', () => {
  it('always looks forward, so it is never negative', () => {
    const gap = calculateClassEstimatedGap(
      { estTime: 20, classEstTime: 100 },
      { estTime: 30, classEstTime: 100 }
    );

    expect(gap).toBeGreaterThan(0);
  });

  it('measures round to the leader when it is behind on track', () => {
    // Leader at 10% of a 100s lap, chaser at 90%: the chaser reaches it in 20s,
    // not minus 80.
    const gap = calculateClassEstimatedGap(
      { estTime: 10, classEstTime: 100 },
      { estTime: 90, classEstTime: 100 }
    );

    expect(gap).toBeCloseTo(20, 5);
  });

  it('scales the car ahead into the chasing class', () => {
    const gap = calculateClassEstimatedGap(
      { estTime: 50, classEstTime: 100 },
      { estTime: 25, classEstTime: 200 }
    );

    // 50s at 100s pace is half a lap; half a lap at 200s pace is 100s, minus
    // the chaser's own 25s.
    expect(gap).toBeCloseTo(75, 5);
  });
});

describe('getTimeAtPosition', () => {
  const lap = linearLap(120);

  it('reads the start of the lap as zero elapsed', () => {
    expect(getTimeAtPosition(lap, 0)).toBeCloseTo(0, 3);
  });

  it('interpolates between grid points', () => {
    // Half way round a linear 120s lap is 60s.
    expect(getTimeAtPosition(lap, 0.5)).toBeCloseTo(60, 1);
  });

  it('interpolates within a single bucket rather than snapping to it', () => {
    const between = getTimeAtPosition(lap, 0.5 + lap.interval / 2);
    const onGrid = getTimeAtPosition(lap, 0.5);

    expect(between).toBeGreaterThan(onGrid);
  });
});

describe('calculateReferenceDelta', () => {
  const lap = linearLap(120);

  it('is positive when the opponent is ahead', () => {
    expect(calculateReferenceDelta(lap, 0.6, 0.5)).toBeGreaterThan(0);
  });

  it('is negative when the opponent is behind', () => {
    expect(calculateReferenceDelta(lap, 0.4, 0.5)).toBeLessThan(0);
  });

  it('wraps forward when the opponent is just over the line', () => {
    // Opponent at 1%, player at 99%: the opponent is a whisker ahead, not
    // almost a full lap behind.
    const delta = calculateReferenceDelta(lap, 0.01, 0.99);

    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(10);
  });

  it('wraps backward when the player is just over the line', () => {
    const delta = calculateReferenceDelta(lap, 0.99, 0.01);

    expect(delta).toBeLessThan(0);
    expect(delta).toBeGreaterThan(-10);
  });
});

describe('calculateReferenceGap', () => {
  const lap = linearLap(120);

  it('measures forward to an opponent ahead', () => {
    expect(calculateReferenceGap(lap, 0.75, 0.25)).toBeCloseTo(60, 0);
  });

  it('measures the long way round to an opponent behind', () => {
    // Never negative: the gap is how long until the player reaches that point.
    const gap = calculateReferenceGap(lap, 0.25, 0.75);

    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeCloseTo(60, 0);
  });

  it('is a whole lap apart at the extremes', () => {
    const gap = calculateReferenceGap(lap, 0.001, 0.999);

    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(5);
  });
});
