import { describe, expect, it } from 'vitest';
import type { BlindSpotSnapshot } from '@irdashies/types';
import { deriveRadarCars } from './deriveRadarCars';

const snapshot: BlindSpotSnapshot = {
  carLeftRight: 0,
  carIdxLapDistPct: [0.5, 0.51, 0.49, 0.6],
  carIdxOnPitRoad: [false, false, true, false],
  carIdxClass: [2, 2, 3, 3],
  relativeAvailable: [false, true, true, true],
  relativeLateral: [0, -3, 2, 35],
  relativeLongitudinal: [0, -8, 4, 0],
  relativeHeading: [0, 0.2, 0, 0],
  isOnTrack: true,
  version: 1,
};

describe('deriveRadarCars', () => {
  it('uses LMU positions and excludes pit-road and out-of-range cars', () => {
    expect(deriveRadarCars(snapshot, 0, 30)).toEqual([
      expect.objectContaining({
        carIdx: 1,
        lateral: -3,
        longitudinal: -8,
        heading: 0.2,
        sameClass: true,
      }),
    ]);
  });

  it('returns no cars when LMU relative positions are unavailable', () => {
    const iracingSnapshot: BlindSpotSnapshot = {
      carLeftRight: 0,
      carIdxLapDistPct: [0.5, 0.51],
      isOnTrack: true,
      version: 1,
    };

    expect(deriveRadarCars(iracingSnapshot, 0, 30)).toEqual([]);
  });
});
