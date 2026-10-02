import { describe, expect, it } from 'vitest';
import type { RadarCar } from '@irdashies/types';
import {
  nearestDistance,
  nextAutoHideVisible,
  selectRadarCars,
} from './radarModel';

const car = (carIdx: number, dist: number, onPitRoad = false): RadarCar => ({
  carIdx,
  dist,
  closingSpeed: 0,
  lane: 0,
  laneSource: 'none',
  onPitRoad,
  offTrack: false,
});

const options = { range: 30, carLength: 4.5, hideInPit: true };

describe('selectRadarCars', () => {
  it('keeps cars until their body has left the disc', () => {
    const cars = [car(1, 34), car(2, -34.6), car(3, 10)];

    expect(
      selectRadarCars({ cars, focusOnPitRoad: false }, options).map(
        (c) => c.carIdx
      )
    ).toEqual([1, 3]);
  });

  it('hides cars across the pit wall only when asked', () => {
    const cars = [car(1, 5, true), car(2, 8)];

    expect(
      selectRadarCars({ cars, focusOnPitRoad: false }, options).map(
        (c) => c.carIdx
      )
    ).toEqual([2]);
    expect(
      selectRadarCars({ cars, focusOnPitRoad: true }, options).map(
        (c) => c.carIdx
      )
    ).toEqual([1]);
    expect(
      selectRadarCars(
        { cars, focusOnPitRoad: false },
        { ...options, hideInPit: false }
      )
    ).toHaveLength(2);
  });
});

describe('nearestDistance', () => {
  it('ignores direction and is Infinity for an empty radar', () => {
    expect(nearestDistance([car(1, 12), car(2, -7)])).toBe(7);
    expect(nearestDistance([])).toBe(Infinity);
  });
});

describe('nextAutoHideVisible', () => {
  const thresholds = { showDistance: 20, hideDistance: 25 };

  it('appears at the show distance and leaves past the hide distance', () => {
    expect(nextAutoHideVisible(false, 22, thresholds)).toBe(false);
    expect(nextAutoHideVisible(false, 20, thresholds)).toBe(true);
    expect(nextAutoHideVisible(true, 24, thresholds)).toBe(true);
    expect(nextAutoHideVisible(true, 25.1, thresholds)).toBe(false);
    expect(nextAutoHideVisible(true, Infinity, thresholds)).toBe(false);
  });

  it('never hides inside the show distance, even if set inverted', () => {
    expect(
      nextAutoHideVisible(true, 18, { showDistance: 20, hideDistance: 10 })
    ).toBe(true);
  });
});
