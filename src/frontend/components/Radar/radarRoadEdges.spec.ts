import { describe, expect, it } from 'vitest';
import { buildTrackGeometry } from '@irdashies/domain/track';
import { RadarProjector, type ScreenPose } from './radarProjection';
import {
  createRoadEdgeTrace,
  ROAD_EDGE_BLEND_M,
  roadEdgeAt,
  traceRoadEdges,
  validRoadEdges,
} from './radarRoadEdges';

const edges = [0.1, 0.01, 3, 4, 5, 6, -4, -5, -6];

describe('validRoadEdges', () => {
  it('accepts a window whose length matches its count', () => {
    expect(validRoadEdges(edges)).toBe(true);
    expect(validRoadEdges(edges.slice(0, 8))).toBe(false);
    expect(validRoadEdges([0.1, 0, 3, ...edges.slice(3)])).toBe(false);
    expect(validRoadEdges(null)).toBe(false);
  });
});

describe('roadEdgeAt', () => {
  it('interpolates between samples', () => {
    expect(roadEdgeAt(edges, 0.1, 'left')).toBeCloseTo(4);
    expect(roadEdgeAt(edges, 0.115, 'left')).toBeCloseTo(5.5);
    expect(roadEdgeAt(edges, 0.12, 'right')).toBeCloseTo(-6);
  });

  it('gives nothing outside the window', () => {
    expect(roadEdgeAt(edges, 0.099, 'left')).toBeNaN();
    expect(roadEdgeAt(edges, 0.121, 'left')).toBeNaN();
  });

  it('wraps across the start/finish line', () => {
    const wrapped = [0.995, 0.01, 3, 1, 2, 3, -1, -2, -3];
    expect(roadEdgeAt(wrapped, 0.005, 'left')).toBeCloseTo(2);
    expect(roadEdgeAt(wrapped, 1.005, 'right')).toBeCloseTo(-2);
  });

  it('uses the known neighbour of an unknown sample, including one sent as null', () => {
    const partial = [0, 0.01, 3, 4, Number.NaN, 6, -4, null, -6] as number[];
    expect(roadEdgeAt(partial, 0.005, 'left')).toBeCloseTo(4);
    expect(roadEdgeAt(partial, 0.005, 'right')).toBeCloseTo(-4);
    expect(roadEdgeAt(partial, 0.015, 'right')).toBeCloseTo(-6);
    const empty = [0, 0.01, 2, Number.NaN, Number.NaN, null, null] as number[];
    expect(roadEdgeAt(empty, 0.005, 'left')).toBeNaN();
    expect(roadEdgeAt(empty, 0.005, 'right')).toBeNaN();
  });
});

describe('traceRoadEdges', () => {
  const geometry = buildTrackGeometry(
    {
      trackPathPoints: Array.from({ length: 101 }, (_, index) => ({
        x: 500 + 400 * Math.cos((index / 100) * Math.PI * 2),
        y: 500 + 400 * Math.sin((index / 100) * Math.PI * 2),
      })),
      totalLength: 100,
      startFinishLength: 0,
      direction: 'anticlockwise',
    },
    2500
  );

  it('puts each edge where the projector puts that offset', () => {
    const projector = new RadarProjector();
    projector.setup(geometry, 2500, 0.3, 100, 100, 2);
    const window = [0.29, 0.001, 21, ...new Array<number>(21).fill(4)];
    window.push(...new Array<number>(21).fill(-5));
    const pose: ScreenPose = { x: 0, y: 0, angle: 0 };
    const trace = traceRoadEdges(
      createRoadEdgeTrace(),
      projector,
      pose,
      window,
      0.3,
      2500,
      20,
      1,
      7,
      -7
    );

    expect(trace.count).toBe(41);
    const expected: ScreenPose = { x: 0, y: 0, angle: 0 };
    projector.project(-20, 4, expected);
    expect(trace.leftX[0]).toBeCloseTo(expected.x);
    expect(trace.leftY[0]).toBeCloseTo(expected.y);
    projector.project(20, -5, expected);
    expect(trace.rightX[40]).toBeCloseTo(expected.x);
    expect(trace.rightY[40]).toBeCloseTo(expected.y);
  });

  it('falls back to the fixed width where the window says nothing', () => {
    const projector = new RadarProjector();
    projector.setup(geometry, 2500, 0.3, 100, 100, 2);
    const window = [0.3, 0.001, 3, 4, 4, 4, -5, -5, -5];
    const pose: ScreenPose = { x: 0, y: 0, angle: 0 };
    const trace = traceRoadEdges(
      createRoadEdgeTrace(),
      projector,
      pose,
      window,
      0.3,
      2500,
      20,
      1,
      7,
      -7
    );

    const expected: ScreenPose = { x: 0, y: 0, angle: 0 };
    projector.project(-20, 7, expected);
    expect(trace.leftX[0]).toBeCloseTo(expected.x);
    projector.project(0, 7 + (4 - 7) * 0.1, expected);
    expect(trace.leftX[20]).toBeCloseTo(expected.x);
    expect(trace.leftY[20]).toBeCloseTo(expected.y);
  });

  it('blends from the fixed width into the learned edge over 10 m', () => {
    const projector = new RadarProjector();
    projector.setup(geometry, 2500, 0.3, 100, 100, 2);
    const window = [0.3, 0.001, 30, ...new Array<number>(30).fill(4)];
    window.push(...new Array<number>(30).fill(-5));
    const pose: ScreenPose = { x: 0, y: 0, angle: 0 };
    const trace = traceRoadEdges(
      createRoadEdgeTrace(),
      projector,
      pose,
      window,
      0.3,
      2500,
      20,
      1,
      7,
      -7
    );

    const expected: ScreenPose = { x: 0, y: 0, angle: 0 };
    projector.project(4, 7 + (4 - 7) * 0.5, expected);
    expect(trace.leftX[24]).toBeCloseTo(expected.x);
    expect(trace.leftY[24]).toBeCloseTo(expected.y);
    projector.project(4, -7 + (-5 + 7) * 0.5, expected);
    expect(trace.rightX[24]).toBeCloseTo(expected.x);
    projector.project(15, 4, expected);
    expect(trace.leftX[35]).toBeCloseTo(expected.x);
    expect(trace.leftY[35]).toBeCloseTo(expected.y);
    expect(ROAD_EDGE_BLEND_M).toBe(10);
  });
});
