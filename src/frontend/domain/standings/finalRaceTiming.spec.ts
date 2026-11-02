import { describe, expect, it } from 'vitest';
import type { RaceFinishTiming } from '@irdashies/types';
import type { Standings } from './createStandings';
import { augmentStandingsWithFinalTiming } from './finalRaceTiming';

const rows = [0, 1, 2].map(
  (carIdx) =>
    ({
      carIdx,
      isPlayer: carIdx === 1,
      onTrack: false,
      gap: { value: undefined, laps: 0 },
      interval: undefined,
    }) as Standings
);
const timings: RaceFinishTiming[] = [
  { lapsComplete: 29, crossingTime: 100, resultTime: 0 },
  { lapsComplete: 29, crossingTime: 110, resultTime: 9.5 },
  { lapsComplete: 29, crossingTime: 113, resultTime: 12.75 },
];
const apply = (
  data = timings,
  playerReference = false,
  drivers = rows,
  showLapDifferences = false
) =>
  augmentStandingsWithFinalTiming([['1', drivers]], data, {
    gap: true,
    interval: true,
    playerReference,
    showLapDifferences,
  })[0][1];

describe('final race gap and interval selectors', () => {
  it('shows official gaps and intervals after all cars leave the track', () => {
    expect(apply().map((r) => ({ gap: r.gap, interval: r.interval }))).toEqual([
      { gap: { value: undefined, laps: 0 }, interval: undefined },
      { gap: { value: 9.5, laps: 0 }, interval: 9.5 },
      { gap: { value: 12.75, laps: 0 }, interval: 3.25 },
    ]);
  });
  it('falls back to observed crossings while results are provisional', () => {
    const provisional = timings.map(({ lapsComplete, crossingTime }) => ({
      lapsComplete,
      crossingTime,
    }));
    expect(apply(provisional)[2]).toMatchObject({
      gap: { value: 13, laps: 0 },
      interval: 3,
    });
  });
  it('keeps unfinished cars live', () => {
    const unfinished = { ...rows[2], gap: { value: 17, laps: 0 }, interval: 6 };
    expect(
      apply(timings.slice(0, 2), false, [rows[0], rows[1], unfinished])[2]
    ).toBe(unfinished);
  });
  it('follows camera focus while intervals keep their class reference', () => {
    expect(apply(timings, true).map((r) => r.gap?.value)).toEqual([
      -9.5, 0, 3.25,
    ]);
    const focused = rows.map((r) => ({ ...r, isPlayer: r.carIdx === 2 }));
    const switched = apply(timings, true, focused);
    expect(switched.map((r) => r.gap?.value)).toEqual([-12.75, -3.25, 0]);
    expect(switched[2].interval).toBe(3.25);
  });
  it.each([1, 2])('retains a %i lap interval after the race', (laps) => {
    const lapped = [
      ...timings.slice(0, 2),
      { lapsComplete: 29 - laps, crossingTime: 105, resultTime: 40 },
    ];
    expect(apply(lapped, false, rows, true)[2]).toMatchObject({
      gap: { laps: -laps, value: undefined },
      interval: { laps: -laps, value: undefined },
    });
    expect(apply(lapped, true, rows, true)[2].gap).toEqual({
      laps,
      value: undefined,
    });
    expect(apply(lapped, true, rows, true)[2].interval).toEqual({
      laps: -laps,
      value: undefined,
    });
    // Legacy time mode leaves the interval blank across different lap counts.
    expect(apply(lapped)[2].interval).toBeUndefined();
  });
  it('does not mix timing sources when only one official delta is available', () => {
    const incomplete = [
      { lapsComplete: 29, resultTime: 0 },
      { lapsComplete: 29, crossingTime: 110 },
    ];
    expect(apply(incomplete)[1].gap?.value).toBeUndefined();
  });
  it('preserves true zero gaps and intervals', () => {
    const tied = timings.map((r) => ({ ...r, resultTime: 0 }));
    expect(apply(tied)[2]).toMatchObject({
      gap: { value: 0, laps: 0 },
      interval: 0,
    });
  });
  it('respects disabled gap and interval settings', () => {
    const result = augmentStandingsWithFinalTiming([['1', rows]], timings, {
      gap: false,
      interval: false,
      playerReference: false,
    });
    expect(result[0][1]).toEqual(rows);
  });
});
