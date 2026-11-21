import { describe, expect, it } from 'vitest';
import type { RadarCar } from '@irdashies/types';
import {
  applyWorldOffset,
  hasWorldChannels,
  WORLD_LANE_WIDTH_M,
  worldLaneOf,
  type RadarWorldChannels,
} from './radarWorld';

const carAt = (dist: number): RadarCar => ({
  carIdx: 1,
  dist,
  relativeSpeed: 0,
  lane: 0,
  laneSource: 'none',
  onPitRoad: false,
  offTrack: false,
});

const channels = (
  lateral: number,
  longitudinal: number,
  heading = 0
): RadarWorldChannels => ({
  available: [false, true],
  lateral: [0, lateral],
  longitudinal: [0, longitudinal],
  heading: [0, heading],
});

describe('hasWorldChannels', () => {
  it('is false for a frame from a sim that sends no positions', () => {
    expect(
      hasWorldChannels({
        available: [],
        lateral: [],
        longitudinal: [],
        heading: [],
      })
    ).toBe(false);
  });

  it('is true once the sim publishes availability', () => {
    expect(hasWorldChannels(channels(0, 0))).toBe(true);
  });
});

describe('applyWorldOffset', () => {
  it('replaces the lap-distance estimate with the measured offset', () => {
    const car = carAt(1);
    expect(applyWorldOffset(car, channels(-3, 2.5, 0.2), 1)).toBe(true);

    expect(car).toMatchObject({
      dist: 2.5,
      lateralM: -3,
      headingRad: 0.2,
      laneSource: 'world',
    });
    expect(car.lane).toBeCloseTo(-3 / WORLD_LANE_WIDTH_M);
  });

  it('leaves a car with no published position alone', () => {
    const car = carAt(10);
    expect(applyWorldOffset(car, channels(0, 0), 0)).toBe(false);
    expect(car.laneSource).toBe('none');
  });

  it('ignores a non-finite offset', () => {
    const car = carAt(10);
    expect(applyWorldOffset(car, channels(Number.NaN, 10), 1)).toBe(false);
    expect(car.laneSource).toBe('none');
  });

  it('accepts a car a corner away when the chord is close to the arc', () => {
    expect(applyWorldOffset(carAt(60), channels(17.5, 56.4), 1)).toBe(true);
  });

  it('rejects a car much closer in a straight line than along the track', () => {
    expect(applyWorldOffset(carAt(80), channels(4, 19), 1)).toBe(false);
  });

  it('rejects a straight-line distance beyond the track distance', () => {
    expect(applyWorldOffset(carAt(10), channels(0, 25), 1)).toBe(false);
  });

  it('rejects a car on the opposite side of us along the track', () => {
    expect(applyWorldOffset(carAt(30), channels(1, -30), 1)).toBe(false);
  });

  it('trusts the measurement for a car alongside whatever the lap distance says', () => {
    const car = carAt(-4);
    expect(applyWorldOffset(car, channels(3, 1), 1)).toBe(true);
    expect(car.dist).toBe(1);
  });

  it('treats a missing heading as straight ahead', () => {
    const car = carAt(5);
    const withoutHeading = { ...channels(3, 5), heading: [] };
    expect(applyWorldOffset(car, withoutHeading, 1)).toBe(true);
    expect(car.headingRad).toBe(0);
  });
});

describe('worldLaneOf', () => {
  it('counts lanes in nominal car widths and caps the outer lane', () => {
    expect(worldLaneOf(WORLD_LANE_WIDTH_M)).toBeCloseTo(1);
    expect(worldLaneOf(-WORLD_LANE_WIDTH_M * 1.5)).toBeCloseTo(-1.5);
    expect(worldLaneOf(500)).toBe(4);
  });
});
