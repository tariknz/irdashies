import { beforeEach, describe, expect, it } from 'vitest';
import { buildTrackGeometry } from '@irdashies/domain/track';
import { RadarProjector, type ScreenPose } from './radarProjection';
import { projectCar, projector as shared } from './radarDrawShared';

const setUp = () => {
  const projector = new RadarProjector();
  projector.setup(null, 4000, 0.5, 100, 100, 2);
  return projector;
};

const blank = (): ScreenPose => ({ x: 0, y: 0, angle: 0 });

describe('RadarProjector.projectOffset', () => {
  it('puts a car ahead above the centre and one behind below it', () => {
    const projector = setUp();
    const ahead = projector.projectOffset(10, 0, 0, blank());
    const behind = projector.projectOffset(-10, 0, 0, blank());

    expect(ahead).toMatchObject({ x: 100, y: 80 });
    expect(behind).toMatchObject({ x: 100, y: 120 });
  });

  it('puts a car on our left to the left of the centre', () => {
    const left = setUp().projectOffset(0, 3, 0, blank());

    expect(left.x).toBeCloseTo(94);
    expect(left.y).toBeCloseTo(100);
  });

  it('points a car the way it is heading relative to us', () => {
    const projector = setUp();

    expect(projector.projectOffset(0, 0, 0, blank()).angle).toBeCloseTo(
      -Math.PI / 2
    );
    expect(projector.projectOffset(0, 0, 0.3, blank()).angle).toBeCloseTo(
      -Math.PI / 2 - 0.3
    );
  });

  it('agrees with the track projection on a straight road', () => {
    const projector = setUp();
    const along = projector.project(12, 3, blank());
    const offset = projector.projectOffset(12, 3, 0, blank());

    expect(offset.x).toBeCloseTo(along.x);
    expect(offset.y).toBeCloseTo(along.y);
  });
});

describe('projectCar', () => {
  beforeEach(() => {
    shared.setup(null, 4000, 0.5, 100, 100, 2);
  });

  it('uses the measured offset for a world car', () => {
    const car = { dist: 6, lateral: 2, world: true, heading: 0.1 };
    const placed = projectCar(car, blank());

    expect(placed.x).toBeCloseTo(100 - 2 * 2);
    expect(placed.y).toBeCloseTo(100 - 6 * 2);
    expect(placed.angle).toBeCloseTo(-Math.PI / 2 - 0.1);
  });

  it('keeps the track projection for any other car', () => {
    const car = { dist: 6, lateral: 2 };
    const expected = shared.project(6, 2, blank());

    expect(projectCar(car, blank())).toMatchObject(expected);
  });
});

describe('RadarProjector with a fitted map frame', () => {
  const geometry = buildTrackGeometry(
    {
      trackPathPoints: [
        { x: 0, y: 0 },
        { x: 1250, y: 0 },
        { x: 1250, y: 1250 },
        { x: 0, y: 1250 },
        { x: 0, y: 0 },
      ],
      totalLength: 5000,
      startFinishLength: 0,
      direction: 'anticlockwise',
    },
    5000
  );
  const ppm = 2;
  const lineAtPlayer = { x: 500, y: 0 };

  const setUpWithFrame = (originY: number) => {
    const projector = new RadarProjector();
    projector.setup(geometry, 5000, 0.1, 100, 100, ppm, [
      lineAtPlayer.x,
      originY,
      0,
      1,
      1,
      0,
    ]);
    return projector;
  };

  it('draws the road from the fitted frame', () => {
    const road = setUpWithFrame(0).project(20, 0, blank());

    expect(road.x).toBeCloseTo(100, 0);
    expect(road.y).toBeCloseTo(100 - 20 * ppm, 0);
    expect(road.angle).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('moves the road away from us when we are off the line', () => {
    const road = setUpWithFrame(-6).project(0, 0, blank());

    expect(road.x).toBeCloseTo(100 + 6 * ppm, 0);
    expect(road.y).toBeCloseTo(100, 0);
  });

  it('offsets a lateral position across the road in our frame', () => {
    const left = setUpWithFrame(0).project(0, 3, blank());

    expect(left.x).toBeCloseTo(100 - 3 * ppm, 0);
  });

  it('keeps the straight road when there is no track drawing', () => {
    const projector = new RadarProjector();
    projector.setup(null, 5000, 0.1, 100, 100, ppm, [500, 0, 0, 1, 1, 0]);

    expect(projector.project(20, 0, blank())).toMatchObject({ x: 100, y: 60 });
  });

  it('ignores a malformed frame', () => {
    const projector = new RadarProjector();
    projector.setup(geometry, 5000, 0.1, 100, 100, ppm, [1, 2, 3]);
    const fallback = new RadarProjector();
    fallback.setup(geometry, 5000, 0.1, 100, 100, ppm);

    expect(projector.project(20, 0, blank())).toMatchObject(
      fallback.project(20, 0, blank())
    );
  });
});
