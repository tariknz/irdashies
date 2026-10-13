import { describe, expect, it } from 'vitest';
import {
  buildTrackGeometry,
  pointAtProgress,
  tangentAtProgress,
  type TrackPathData,
} from './trackGeometry';

const RADIUS = 500;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const build = (...args: Parameters<typeof buildTrackGeometry>) => {
  const geometry = buildTrackGeometry(...args);
  if (!geometry) throw new Error('expected a geometry');
  return geometry;
};

/** A circle traced on the pixel grid, the way tracks.json stores paths. */
const circlePath = (
  direction: TrackPathData['direction'],
  roundToPixels = false
): TrackPathData => {
  const points = [];
  const count = Math.round(CIRCUMFERENCE);
  for (let index = 0; index <= count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const x = 1000 + RADIUS * Math.cos(angle);
    const y = 600 + RADIUS * Math.sin(angle);
    points.push(
      roundToPixels ? { x: Math.round(x), y: Math.round(y) } : { x, y }
    );
  }
  return {
    trackPathPoints: points,
    totalLength: CIRCUMFERENCE,
    startFinishLength: 0,
    direction,
  };
};

describe('buildTrackGeometry', () => {
  it('measures drawing units per metre of real track', () => {
    const geometry = build(circlePath('anticlockwise'), 1000);

    expect(geometry.unitsPerMeter).toBeCloseTo(CIRCUMFERENCE / 1000, 1);
  });

  it('rejects empty paths and unknown track lengths', () => {
    const path = circlePath('anticlockwise');
    expect(buildTrackGeometry({ ...path, trackPathPoints: [] }, 1000)).toBe(
      null
    );
    expect(buildTrackGeometry(path, 0)).toBe(null);
  });

  it('starts at the start/finish line and follows the drawing direction', () => {
    const forward = build(circlePath('anticlockwise'), 1000);
    const backward = build(circlePath('clockwise'), 1000);
    const start = { x: 0, y: 0 };
    const quarter = { x: 0, y: 0 };

    pointAtProgress(forward, 0, start);
    expect(start.x).toBeCloseTo(1500, 0);
    expect(start.y).toBeCloseTo(600, 0);

    // Anticlockwise runs along the path (angle grows), clockwise against it.
    pointAtProgress(forward, 0.25, quarter);
    expect(quarter.y).toBeGreaterThan(1050);
    pointAtProgress(backward, 0.25, quarter);
    expect(quarter.y).toBeLessThan(150);
  });

  it('wraps progress outside 0..1', () => {
    const geometry = build(circlePath('anticlockwise'), 1000);
    const a = pointAtProgress(geometry, -0.1, { x: 0, y: 0 });
    const b = pointAtProgress(geometry, 0.9, { x: 0, y: 0 });

    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('tangentAtProgress', () => {
  it('points in the direction of increasing progress', () => {
    const geometry = build(circlePath('anticlockwise'), 1000);
    const tangent = tangentAtProgress(geometry, 0, { x: 0, y: 0 });

    // At angle 0 an anticlockwise lap heads towards +y.
    expect(tangent.x).toBeCloseTo(0, 2);
    expect(tangent.y).toBeCloseTo(1, 2);
  });

  it('stays steady over a path traced on the pixel grid', () => {
    const geometry = build(circlePath('anticlockwise', true), 1000);
    const tangent = { x: 0, y: 0 };
    let largestTurn = 0;
    let previous = Math.atan2(
      tangentAtProgress(geometry, 0, tangent).y,
      tangent.x
    );
    // One-metre steps around the lap: a 1000 m circle turns 0.36 deg a metre.
    for (let metre = 1; metre < 1000; metre += 1) {
      tangentAtProgress(geometry, metre / 1000, tangent);
      const angle = Math.atan2(tangent.y, tangent.x);
      let turn = Math.abs(angle - previous);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      largestTurn = Math.max(largestTurn, turn);
      previous = angle;
    }

    expect((largestTurn * 180) / Math.PI).toBeLessThan(1);
  });
});
