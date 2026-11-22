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

describe('RadarProjector in the focus car frame', () => {
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
  const playerPct = 0.1;
  const ppm = 2;

  const setUpOnStraight = (focusYawRad: number | null) => {
    const projector = new RadarProjector();
    projector.setup(geometry, 5000, playerPct, 100, 100, ppm, focusYawRad);
    return projector;
  };

  it('draws the road as before when our heading follows the track', () => {
    const alongTrack = setUpOnStraight(null).project(20, 0, blank());
    const headingAlong = setUpOnStraight(0).project(20, 0, blank());

    expect(headingAlong.x).toBeCloseTo(alongTrack.x, 1);
    expect(headingAlong.y).toBeCloseTo(alongTrack.y, 1);
  });

  it('turns the road the other way when our car points off the track', () => {
    const turnedLeft = 0.2;
    const road = setUpOnStraight(turnedLeft).project(20, 0, blank());

    expect(road.x).toBeCloseTo(100 + 20 * Math.sin(turnedLeft) * ppm, 0);
    expect(road.y).toBeCloseTo(100 - 20 * Math.cos(turnedLeft) * ppm, 0);
  });

  it('puts the road where a world car on it is drawn', () => {
    const turnedLeft = 0.2;
    const projector = setUpOnStraight(turnedLeft);
    const road = projector.project(20, 0, blank());
    const worldCar = projector.projectOffset(
      20 * Math.cos(turnedLeft),
      -20 * Math.sin(turnedLeft),
      -turnedLeft,
      blank()
    );

    expect(worldCar.x).toBeCloseTo(road.x, 0);
    expect(worldCar.y).toBeCloseTo(road.y, 0);
    expect(worldCar.angle).toBeCloseTo(road.angle, 2);
  });

  it('keeps the straight road when there is no track drawing', () => {
    const projector = new RadarProjector();
    projector.setup(null, 5000, playerPct, 100, 100, ppm, 0.2);

    expect(projector.project(20, 0, blank())).toMatchObject({ x: 100, y: 60 });
  });
});
