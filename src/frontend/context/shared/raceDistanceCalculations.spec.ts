import { describe, expect, it } from 'vitest';
import {
  calculateTimedRaceDistance,
  isValidRaceLapTime,
  selectRaceLapTime,
} from './raceDistanceCalculations';

describe('race distance calculations', () => {
  it('rejects transient and invalid lap times', () => {
    expect(isValidRaceLapTime(1)).toBe(false);
    expect(isValidRaceLapTime(Number.NaN)).toBe(false);
    expect(isValidRaceLapTime(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('uses the first plausible lap-time source', () => {
    expect(selectRaceLapTime(1, -1, 98.5, 100, undefined, undefined)).toBe(
      98.5
    );
    expect(
      selectRaceLapTime(1, -1, undefined, undefined, undefined, undefined)
    ).toBeNull();
  });

  it('estimates a 25-minute race without inflating the remaining distance', () => {
    const estimate = calculateTimedRaceDistance(25 * 60, 100, 1, 0, 1, 0);

    expect(estimate).toEqual({
      totalRaceLaps: 15,
      lapsRemaining: 15,
    });
  });

  it('returns no estimate for a one-second leader lap', () => {
    expect(calculateTimedRaceDistance(25 * 60, 1, 1, 0, 1, 0)).toBeNull();
  });

  it('accounts for player progress when returning remaining laps', () => {
    const estimate = calculateTimedRaceDistance(500, 100, 3, 0.5, 3, 0.75);

    expect(estimate?.totalRaceLaps).toBe(7.75);
    expect(estimate?.lapsRemaining).toBe(5.5);
  });
});
