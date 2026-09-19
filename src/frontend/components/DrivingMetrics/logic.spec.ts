import { describe, expect, it } from 'vitest';
import type { FuelLapData, TrackNote } from '@irdashies/types';
import {
  groupStints,
  integrateDistance,
  mapGForce,
  noteIsTriggered,
  updateAccelerationTimer,
} from './logic';

describe('driving metrics logic', () => {
  it('times configured acceleration windows and rearms below the start', () => {
    const window = { fromKph: 0, toKph: 100 };
    const initial = { startedAt: null, elapsed: null, armed: false };
    const armed = updateAccelerationTimer(initial, window, 0, 10, 1);
    const started = updateAccelerationTimer(armed, window, 1, 10.1, 1);
    expect(started.startedAt).toBe(10.1);
    const finished = updateAccelerationTimer(started, window, 101, 13.42, 2);
    expect(finished.elapsed).toBeCloseTo(3.32);
    expect(updateAccelerationTimer(finished, window, -1, 14, -1).armed).toBe(true);
  });

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

  it('triggers notes across normal and wrapped lap progress', () => {
    const note: TrackNote = {
      id: 'one',
      trackId: '1',
      lapDistPct: 0.02,
      text: 'Brake',
      scope: 'always',
    };
    expect(noteIsTriggered(note, 0.03, 0.99, 0.001, false)).toBe(true);
    expect(noteIsTriggered({ ...note, scope: 'pit' }, 0.03, 0.99, 0.001, false)).toBe(false);
  });

  it('integrates speed while rejecting discontinuous timestamps', () => {
    expect(integrateDistance(100, 20, 0.5)).toBe(110);
    expect(integrateDistance(100, 20, 3)).toBe(100);
  });
});
