import { describe, expect, it } from 'vitest';
import type { FuelLapData } from '@irdashies/types';
import {
  groupStints,
  IDLE_ACCELERATION_TIMER,
  integrateDistance,
  mapGForce,
  runningTime,
  updateAccelerationTimer,
} from './logic';

describe('driving metrics logic', () => {
  it('times configured acceleration windows and rearms below the start', () => {
    const window = { fromKph: 0, toKph: 100 };
    const armed = updateAccelerationTimer(
      IDLE_ACCELERATION_TIMER,
      window,
      0,
      10,
      1
    );
    const started = updateAccelerationTimer(armed, window, 1, 10.1, 1);
    expect(started.startedAt).toBeCloseTo(10.05);
    const finished = updateAccelerationTimer(started, window, 100, 13.42, 2);
    expect(finished.elapsed).toBeCloseTo(3.37);
    expect(updateAccelerationTimer(finished, window, -1, 14, -1).armed).toBe(
      true
    );
  });

  it('places the start and finish where the speed crossed between samples', () => {
    const window = { fromKph: 100, toKph: 200 };
    let state = updateAccelerationTimer(
      IDLE_ACCELERATION_TIMER,
      window,
      90,
      0,
      3
    );
    state = updateAccelerationTimer(state, window, 110, 1, 3);
    expect(state.startedAt).toBeCloseTo(0.5);
    state = updateAccelerationTimer(state, window, 190, 2, 4);
    state = updateAccelerationTimer(state, window, 210, 3, 5);
    expect(state.elapsed).toBeCloseTo(2);
  });

  it('keeps the last result after rearming until the next run starts', () => {
    const window = { fromKph: 100, toKph: 200 };
    const finished = { ...IDLE_ACCELERATION_TIMER, elapsed: 6.4 };
    const rearmed = updateAccelerationTimer(finished, window, 80, 30, 3);
    expect(rearmed).toMatchObject({ armed: true, elapsed: 6.4 });
    const restarted = updateAccelerationTimer(rearmed, window, 101, 35, 4);
    expect(restarted.elapsed).toBeNull();
    expect(restarted.startedAt).toBeCloseTo(30 + (20 / 21) * 5);
  });

  it('drops a run in progress when the session clock goes backwards', () => {
    const window = { fromKph: 0, toKph: 100 };
    const running = {
      ...IDLE_ACCELERATION_TIMER,
      startedAt: 500,
      lastSpeedKph: 60,
      lastTime: 503,
    };
    const reset = updateAccelerationTimer(running, window, 60, 2, 3);
    expect(reset).toMatchObject({ startedAt: null, armed: false });
    expect(runningTime(running, 2)).toBeNull();
    expect(runningTime(running, 503.5)).toBeCloseTo(3.5);
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
