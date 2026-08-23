import { describe, expect, it } from 'vitest';
import {
  traceAnchor,
  gapToClassLeader,
  positionByLap,
  raceTrace,
  traceOrigin,
} from './lapSeries';
import type { LapCrossing } from './types';

const crossing = (
  lap: number,
  sessionTime: number,
  overrides: Partial<LapCrossing> = {}
): LapCrossing => ({
  lap,
  sessionTime,
  classPosition: 1,
  inPit: false,
  offTrack: false,
  lapped: false,
  ...overrides,
});

/** Crossings for a car lapping at exactly `seconds` from `startTime`. */
const evenPace = (
  laps: number,
  seconds: number,
  startTime: number,
  firstLap = 1
): LapCrossing[] =>
  Array.from({ length: laps }, (_, i) =>
    crossing(firstLap + i, startTime + i * seconds)
  );

describe('raceTrace', () => {
  it('is a flat line for a car lapping at exactly the reference pace', () => {
    const points = raceTrace(evenPace(10, 90, 100), 90);

    const values = points.map((point) => point.value);
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBeCloseTo(-10, 10);
    expect(points.map((point) => point.lap)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('is flat at zero for the leader when the origin comes from traceOrigin', () => {
    const leader = evenPace(6, 90, 100);
    const origin = traceOrigin(leader, 90);

    const values = raceTrace(leader, 90, origin).map((point) => point.value);

    values.forEach((value) => expect(value).toBeCloseTo(0, 10));
  });

  it('gives the same value to two cars crossing a lap at the same instant', () => {
    // Regression: a per-car lap origin pushed cars a whole reference lap apart
    // whenever their first retained crossing differed - which the ring buffer
    // makes routine once a long race wraps.
    const fromLap1 = evenPace(10, 90, 100);
    const fromLap2 = evenPace(9, 90, 190, 2);
    expect(fromLap1[9].sessionTime).toBe(fromLap2[8].sessionTime);

    const origin = traceOrigin(fromLap1, 90);
    const traceA = raceTrace(fromLap1, 90, origin);
    const traceB = raceTrace(fromLap2, 90, origin);

    expect(traceA[9].lap).toBe(10);
    expect(traceB[8].lap).toBe(10);
    expect(traceB[8].value).toBeCloseTo(traceA[9].value, 10);
  });

  it('keeps two cars at reference pace separated by their real gap', () => {
    const leader = raceTrace(evenPace(5, 90, 100), 90);
    const chaser = raceTrace(evenPace(5, 90, 105), 90);

    leader.forEach((point, i) => {
      expect(point.value - chaser[i].value).toBeCloseTo(5, 10);
    });
  });

  it('shows a pit stop as a step down', () => {
    const crossings = [
      ...evenPace(3, 90, 100),
      // Lap 4 costs 120 s: 90 s of pace plus a 30 s stop.
      crossing(4, 400, { inPit: true }),
      crossing(5, 490),
      crossing(6, 580),
    ];

    const values = raceTrace(crossings, 90).map((point) => point.value);

    expect(values[0]).toBeCloseTo(-10, 10);
    expect(values[2]).toBeCloseTo(-10, 10);
    // The stop drops the trace by its own cost and it stays down.
    expect(values[3]).toBeCloseTo(-40, 10);
    expect(values[4]).toBeCloseTo(-40, 10);
    expect(values[5]).toBeCloseTo(-40, 10);
  });

  it('slopes up for a car faster than the reference', () => {
    const values = raceTrace(evenPace(4, 89, 100), 90).map((p) => p.value);

    expect(values[1] - values[0]).toBeCloseTo(1, 10);
    expect(values[2] - values[1]).toBeCloseTo(1, 10);
  });

  it('returns nothing without crossings or a usable reference', () => {
    expect(raceTrace([], 90)).toEqual([]);
    expect(raceTrace(evenPace(3, 90, 100), 0)).toEqual([]);
    expect(raceTrace(evenPace(3, 90, 100), -90)).toEqual([]);
  });
});

describe('traceOrigin', () => {
  it('projects the leader first crossing back to lap zero', () => {
    expect(traceOrigin(evenPace(5, 90, 100), 90)).toBeCloseTo(10, 10);
    expect(traceOrigin(evenPace(5, 90, 1000, 4), 90)).toBeCloseTo(640, 10);
  });

  it('returns 0 without crossings or a usable reference', () => {
    expect(traceOrigin([], 90)).toBe(0);
    expect(traceOrigin(evenPace(3, 90, 100), 0)).toBe(0);
    expect(traceOrigin(evenPace(3, 90, 100), -90)).toBe(0);
  });
});

describe('gapToClassLeader', () => {
  const leader = evenPace(6, 90, 100);

  it('is negative for a car ahead of the nominal leader', () => {
    const ahead = evenPace(6, 90, 95);

    const points = gapToClassLeader(ahead, leader);

    expect(points).toHaveLength(6);
    points.forEach((point) => expect(point.value).toBeCloseTo(-5, 10));
  });

  it('is positive and growing for a car losing time', () => {
    const behind = evenPace(4, 91, 102);

    const points = gapToClassLeader(behind, leader);

    expect(points.map((point) => point.lap)).toEqual([1, 2, 3, 4]);
    expect(points[0].value).toBeCloseTo(2, 10);
    expect(points[3].value).toBeCloseTo(5, 10);
  });

  it('emits only the laps a lapped car has in common with the leader', () => {
    // Three laps down: the car has completed laps 1 to 3 while the leader is on
    // lap 6. There is no lap 4 to 6 crossing to compare against.
    const lapped = evenPace(3, 120, 100).map((c) => ({ ...c, lapped: true }));

    const points = gapToClassLeader(lapped, leader);

    expect(points.map((point) => point.lap)).toEqual([1, 2, 3]);
    expect(points[0].value).toBeCloseTo(0, 10);
    expect(points[1].value).toBeCloseTo(30, 10);
    expect(points[2].value).toBeCloseTo(60, 10);
  });

  it('skips laps the leader has no crossing for', () => {
    const car = evenPace(6, 90, 100);
    const partialLeader = [leader[0], leader[3]];

    expect(gapToClassLeader(car, partialLeader).map((p) => p.lap)).toEqual([
      1, 4,
    ]);
  });

  it('returns nothing when either side has no crossings', () => {
    expect(gapToClassLeader([], leader)).toEqual([]);
    expect(gapToClassLeader(leader, [])).toEqual([]);
  });
});

describe('positionByLap', () => {
  it('maps laps to in-class positions', () => {
    const points = positionByLap([
      crossing(1, 100, { classPosition: 4 }),
      crossing(2, 190, { classPosition: 3 }),
      crossing(3, 280, { classPosition: 3 }),
      crossing(4, 370, { classPosition: 1 }),
    ]);

    expect(points).toEqual([
      { lap: 1, value: 4 },
      { lap: 2, value: 3 },
      { lap: 3, value: 3 },
      { lap: 4, value: 1 },
    ]);
  });

  it('skips crossings with an unknown position', () => {
    const points = positionByLap([
      crossing(1, 100, { classPosition: 0 }),
      crossing(2, 190, { classPosition: 2 }),
    ]);

    expect(points).toEqual([{ lap: 2, value: 2 }]);
  });

  it('returns nothing without crossings', () => {
    expect(positionByLap([])).toEqual([]);
  });
});

describe('traceAnchor', () => {
  /**
   * The shape of a real race start: the leader crosses the line, runs a slow
   * opening lap, then settles onto reference pace.
   */
  const leader: LapCrossing[] = [
    crossing(0, 88.8),
    crossing(1, 174.98),
    crossing(2, 255.78),
    crossing(3, 336.62),
  ];

  it('anchors on the first completed racing lap, not the start-line crossing', () => {
    const anchor = traceAnchor(leader, 81.3);

    expect(anchor?.fromLap).toBe(1);
    expect(anchor?.originSeconds).toBeCloseTo(174.98 - 81.3, 6);
  });

  it('puts the leader at zero on the anchor lap', () => {
    const anchor = traceAnchor(leader, 81.3);
    const points = raceTrace(
      leader,
      81.3,
      anchor?.originSeconds,
      anchor?.fromLap
    );

    expect(points[0].lap).toBe(1);
    expect(points[0].value).toBeCloseTo(0, 6);
  });

  it('keeps the slow opening lap out of the plotted trace', () => {
    const anchor = traceAnchor(leader, 81.3);
    const points = raceTrace(
      leader,
      81.3,
      anchor?.originSeconds,
      anchor?.fromLap
    );

    // Anchoring on the start-line crossing instead would drop every line by
    // the cost of the start lap and hold it there for the rest of the race.
    expect(points.some((point) => point.lap === 0)).toBe(false);
    for (const point of points) {
      expect(Math.abs(point.value)).toBeLessThan(2);
    }
  });

  it('preserves the real gap between two cars', () => {
    const chaser = leader.map((c) => ({
      ...c,
      sessionTime: c.sessionTime + 5,
    }));
    const anchor = traceAnchor(leader, 81.3);
    const leaderPoints = raceTrace(
      leader,
      81.3,
      anchor?.originSeconds,
      anchor?.fromLap
    );
    const chaserPoints = raceTrace(
      chaser,
      81.3,
      anchor?.originSeconds,
      anchor?.fromLap
    );

    for (let i = 0; i < leaderPoints.length; i += 1) {
      expect(leaderPoints[i].value - chaserPoints[i].value).toBeCloseTo(5, 6);
    }
  });

  it('falls back to the only crossing there is', () => {
    const anchor = traceAnchor([crossing(0, 88.8)], 81.3);

    expect(anchor?.fromLap).toBe(0);
  });

  it('returns nothing without crossings or a usable reference', () => {
    expect(traceAnchor([], 81.3)).toBeUndefined();
    expect(traceAnchor(leader, 0)).toBeUndefined();
  });
});
