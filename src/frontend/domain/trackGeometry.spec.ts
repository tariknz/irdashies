import { describe, expect, it } from 'vitest';
import {
  progressToTrackPoint,
  tangentAngleAt,
  type TrackPathPoint,
} from './trackGeometry';

/**
 * A 400x200 rectangle walked every 20 units: 20 points along the top edge, 10
 * down the right, 20 back along the bottom, 10 up the left. Consecutive points
 * are always 20 units apart, so with TOTAL = 1200 arc length is 20 * index and
 * lap fraction maps onto the path linearly — which makes every expected value
 * below computable by hand from the corner positions.
 */
const rectangle = () => {
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x <= 400; x += 20) points.push({ x, y: 0 });
  for (let y = 20; y <= 200; y += 20) points.push({ x: 400, y });
  for (let x = 380; x >= 0; x -= 20) points.push({ x, y: 200 });
  for (let y = 180; y >= 0; y -= 20) points.push({ x: 0, y });
  return points;
};

const TOTAL = 1200;
const SF = 0;
const pctOfArc = (arc: number) => arc / TOTAL;

describe('progressToTrackPoint', () => {
  it('interpolates between path points in place', () => {
    const output = { x: -1, y: -1 };
    progressToTrackPoint(0.5, rectangle(), TOTAL, SF, 'anticlockwise', output);

    // Arc 600 is the far corner: path index 30 of 60.
    expect(output).toEqual({ x: 400, y: 200 });
  });

  it('writes into the caller-supplied object rather than allocating', () => {
    const output = { x: 0, y: 0 };
    const result = progressToTrackPoint(
      0.25,
      rectangle(),
      TOTAL,
      SF,
      'anticlockwise',
      output
    );

    expect(result).toBeUndefined();
    expect(output).toEqual({ x: 300, y: 0 });
  });

  it('interpolates between the two points that straddle the fraction', () => {
    const output = { x: 0, y: 0 };
    // Arc 310 sits a tenth of the way from index 15 to index 16.
    progressToTrackPoint(
      pctOfArc(310),
      rectangle(),
      TOTAL,
      SF,
      'anticlockwise',
      output
    );

    expect(output.x).toBeCloseTo(310, 9);
    expect(output.y).toBeCloseTo(0, 9);
  });
});

describe('tangentAngleAt', () => {
  it('reports the heading of the straight the car is on', () => {
    // Along the top edge the path runs in +x.
    expect(
      tangentAngleAt(pctOfArc(300), rectangle(), TOTAL, SF, 'anticlockwise')
    ).toBeCloseTo(0, 9);
  });

  it('turns the heading by a quarter turn on the following straight', () => {
    // Arc 500 is on the right-hand edge, where the path runs in +y.
    expect(
      tangentAngleAt(pctOfArc(500), rectangle(), TOTAL, SF, 'anticlockwise')
    ).toBeCloseTo(Math.PI / 2, 9);
  });

  it('turns the heading through a vertex rather than snapping to it', () => {
    // The corner at arc 400 turns from +x to +y. The heading a metre either
    // side and at the vertex are three distinct values in order, each between
    // the two straights and each a small step from its neighbour: the heading
    // follows the car as it moves. Snapping to the nearest vertex instead makes
    // all three identical, which is what made blips rotate in steps.
    const at = (arc: number) =>
      tangentAngleAt(pctOfArc(arc), rectangle(), TOTAL, SF, 'anticlockwise') ??
      NaN;
    const before = at(399);
    const vertex = at(400);
    const after = at(401);

    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(vertex);
    expect(vertex).toBeLessThan(after);
    expect(after).toBeLessThan(Math.PI / 2);
    // Neither step is the whole corner.
    expect(vertex - before).toBeLessThan(Math.PI / 4);
    expect(after - vertex).toBeLessThan(Math.PI / 4);
  });

  it('varies the heading continuously as a car moves along the road', () => {
    // A circle, so the true heading changes smoothly and every step between
    // samples is a measure of the sampling rather than of the track. This is
    // the property the radar depends on: its blips are rotated by the heading,
    // and a heading that steps while the position glides reads as the car
    // steering itself.
    const radius = 100;
    const points = 240;
    const circle = Array.from({ length: points }, (_, i) => {
      const angle = (2 * Math.PI * i) / points;
      return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
    });
    const circumference = 2 * Math.PI * radius;
    const stepM = 0.5;
    let previous: number | null = null;
    let worst = 0;
    for (let metres = 0; metres < circumference; metres += stepM) {
      const heading = tangentAngleAt(
        metres / circumference,
        circle,
        circumference,
        0,
        'anticlockwise'
      );
      if (heading === null) throw new Error('circle has no heading');
      if (previous !== null) {
        const step = Math.abs(
          Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous))
        );
        worst = Math.max(worst, step);
      }
      previous = heading;
    }
    // One path point of this circle subtends 1.5 degrees; sampling every half
    // metre must stay well under the step a snap to the nearest point gives.
    expect(worst).toBeLessThan(0.01);
  });

  it('reflects the running direction of a clockwise track', () => {
    // The same lap fraction on a clockwise track is the mirror point on the
    // bottom edge, travelled the other way — a half turn from the heading at
    // the anticlockwise position.
    const anticlockwise = tangentAngleAt(
      pctOfArc(300),
      rectangle(),
      TOTAL,
      SF,
      'anticlockwise'
    );
    const clockwise = tangentAngleAt(
      pctOfArc(300),
      rectangle(),
      TOTAL,
      SF,
      'clockwise'
    );

    expect(clockwise).toBeCloseTo(Math.PI, 9);
    expect(
      Math.abs(
        Math.abs((clockwise as number) - (anticlockwise as number)) - Math.PI
      )
    ).toBeCloseTo(0, 9);
  });

  it('reads the road through the grid the drawings are quantised to', () => {
    // tracks.json is a polyline on a one-unit grid: on a straight the points
    // step by a pixel every couple of units, so a heading measured across
    // neighbouring points swings by ±18 degrees. The road there is straight,
    // and a blip rotated by the grid rather than the road is what a driver
    // sees as a car twitching and steering itself.
    const straight: TrackPathPoint[] = [];
    const length = 4000;
    for (let x = 0; x <= length; x += 2) {
      // A one-unit step, the size of the grid, alternating every few points.
      straight.push({ x, y: Math.floor(x / 7) % 2 });
    }
    const total = length;

    let worst = 0;
    for (let metres = 20; metres < length - 20; metres += 1) {
      const heading =
        tangentAngleAt(metres / total, straight, total, 0, 'anticlockwise') ??
        NaN;
      worst = Math.max(worst, Math.abs(heading));
    }

    // The grid's own zigzag swings the heading by ±16 degrees; the road is
    // straight, so what is left must be a small fraction of that.
    expect(worst).toBeLessThan(0.05);
  });

  it('refuses to report a heading it cannot derive', () => {
    expect(tangentAngleAt(0.5, [], TOTAL, SF, 'anticlockwise')).toBeNull();
    // Two points make no tangent: there is no neighbour on the far side.
    expect(
      tangentAngleAt(
        0.5,
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        TOTAL,
        SF,
        'anticlockwise'
      )
    ).toBeNull();
    expect(tangentAngleAt(0.5, rectangle(), 0, SF, 'anticlockwise')).toBeNull();
  });

  it('returns null where the two neighbouring points coincide', () => {
    // A path whose samples sit on one spot has no direction there.
    const degenerate = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ];
    expect(
      tangentAngleAt(0.5, degenerate, TOTAL, SF, 'anticlockwise')
    ).toBeNull();
  });
});
