import { describe, expect, it } from 'vitest';
import type { FuelLapData } from '@irdashies/types';
import { groupStints, integrateDistance, mapGForce } from './logic';

describe('driving metrics logic', () => {
  it('groups laps into stints at pit boundaries', () => {
    const lap = (
      lapNumber: number,
      fuelUsed: number,
      lapTime: number,
      extra: Partial<FuelLapData> = {}
    ): FuelLapData => ({
      lapNumber,
      fuelUsed,
      lapTime,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      timestamp: lapNumber,
      sessionNum: 1,
      ...extra,
    });
    const stints = groupStints([
      lap(1, 2, 60),
      lap(2, 2.2, 62, { isInLap: true }),
      lap(3, 2.1, 61, { isOutLap: true }),
    ]);
    expect(stints).toHaveLength(2);
    expect(stints[0]).toMatchObject({ laps: 2, fuelUsed: 4.2, duration: 122 });
    expect(stints[0].consistency).toBe(1);

    const newestFirst = groupStints([
      lap(4, 2, 60),
      lap(3, 2.1, 61, { isOutLap: true }),
      lap(2, 2.2, 62, { isInLap: true }),
      lap(1, 2, 60),
    ]);
    expect(
      newestFirst.map(({ firstLap, lastLap }) => [firstLap, lastLap])
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('maps acceleration to g and preserves signs', () => {
    expect(mapGForce(9.80665, -19.6133)).toEqual({
      lateral: 1,
      longitudinal: -2,
    });
    expect(mapGForce(undefined, Number.NaN)).toEqual({
      lateral: null,
      longitudinal: null,
    });
  });

  it('integrates speed while rejecting discontinuous timestamps', () => {
    expect(integrateDistance(100, 20, 0.5)).toBe(110);
    expect(integrateDistance(100, 20, 3)).toBe(100);
  });
});
