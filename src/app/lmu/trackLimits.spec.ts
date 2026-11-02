import { describe, expect, it } from 'vitest';
import {
  TRACK_LIMITS_UNKNOWN,
  lmuTrackLimitsChannel,
  lmuTrackLimitsMax,
  lmuTrackLimitsPoints,
} from './trackLimits';

describe('lmuTrackLimitsPoints', () => {
  it('divides steps by the scale, as the sim displays it', () => {
    // One step at four to a point is the 0.25 the sim shows.
    expect(lmuTrackLimitsPoints(1, 4)).toBe(0.25);
    expect(lmuTrackLimitsPoints(12, 4)).toBe(3);
  });

  it('reports a clean car as zero, not as unknown', () => {
    expect(lmuTrackLimitsPoints(0, 4)).toBe(0);
  });

  it('has no answer without a scale, rather than calling everyone clean', () => {
    expect(lmuTrackLimitsPoints(5, 0)).toBeUndefined();
    expect(lmuTrackLimitsPoints(5, undefined)).toBeUndefined();
  });

  it('rejects a reading that cannot be a step count', () => {
    expect(lmuTrackLimitsPoints(-1, 4)).toBeUndefined();
    expect(lmuTrackLimitsPoints(NaN, 4)).toBeUndefined();
    expect(lmuTrackLimitsPoints(undefined, 4)).toBeUndefined();
  });
});

describe('lmuTrackLimitsMax', () => {
  it('gives the ceiling in points, so it compares with the current figure', () => {
    expect(lmuTrackLimitsMax(12, 4)).toBe(3);
  });

  it('has no answer without a scale', () => {
    expect(lmuTrackLimitsMax(12, 0)).toBeUndefined();
    expect(lmuTrackLimitsMax(undefined, 4)).toBeUndefined();
  });
});

describe('lmuTrackLimitsChannel', () => {
  it('converts every car', () => {
    expect(lmuTrackLimitsChannel([0, 1, 12], 4)).toEqual([0, 0.25, 3]);
  });

  it('keeps a car with no reading distinct from a clean one', () => {
    expect(lmuTrackLimitsChannel([-1, 0], 4)).toEqual([
      TRACK_LIMITS_UNKNOWN,
      0,
    ]);
  });

  it('is unknown throughout when the scale is missing', () => {
    expect(lmuTrackLimitsChannel([0, 4], 0)).toEqual([-1, -1]);
  });

  it('is empty when the sim reports nothing', () => {
    expect(lmuTrackLimitsChannel(undefined, 4)).toEqual([]);
  });
});
