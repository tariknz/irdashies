import { describe, expect, it } from 'vitest';
import type { Driver, SessionResults } from '@irdashies/types';
import type { Standings } from '@irdashies/domain';
import {
  EMPTY_EXCLUDED_IDXS,
  competitorsOnly,
  excludedCarIdxs,
  excludedStandings,
  reRankClassPositions,
  sanitizeExcludedCars,
  withoutExcluded,
} from './excludedCars';

const result = (
  CarIdx: number,
  Position: number,
  ClassPosition: number
): SessionResults =>
  ({ CarIdx, Position, ClassPosition, FastestTime: 90 }) as SessionResults;

const driver = (CarIdx: number, CarID: number, CarClassID = 1): Driver =>
  ({ CarIdx, CarID, CarClassID }) as Driver;

const sameClass = () => 1;

describe('sanitizeExcludedCars', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeExcludedCars(undefined)).toEqual([]);
    expect(sanitizeExcludedCars('cars')).toEqual([]);
    expect(sanitizeExcludedCars({ carId: 1, name: 'a' })).toEqual([]);
  });

  it('drops bad entries and dedupes by carId', () => {
    expect(
      sanitizeExcludedCars([
        { carId: 1, name: 'Safety' },
        null,
        'x',
        { carId: '2', name: 'Bad id' },
        { carId: 2.5, name: 'Bad id' },
        { carId: 3 },
        { carId: 1, name: 'Duplicate' },
        { carId: 4, name: 'Other' },
      ])
    ).toEqual([
      { carId: 1, name: 'Safety' },
      { carId: 4, name: 'Other' },
    ]);
  });
});

describe('excludedCarIdxs', () => {
  it('matches every car of an excluded model', () => {
    const drivers = [
      driver(0, 10),
      driver(1, 99),
      driver(2, 10),
      driver(3, 99),
    ];
    expect([...excludedCarIdxs(drivers, [{ carId: 99, name: 'SC' }])]).toEqual([
      1, 3,
    ]);
  });

  it('returns the shared empty set when nothing matches', () => {
    expect(excludedCarIdxs(undefined, [{ carId: 99, name: 'SC' }])).toBe(
      EMPTY_EXCLUDED_IDXS
    );
    expect(excludedCarIdxs([driver(0, 10)], [])).toBe(EMPTY_EXCLUDED_IDXS);
    expect(excludedCarIdxs([driver(0, 10)], [{ carId: 99, name: 'SC' }])).toBe(
      EMPTY_EXCLUDED_IDXS
    );
  });
});

describe('withoutExcluded', () => {
  const field = [
    result(5, 1, 0),
    result(6, 2, 1),
    result(7, 3, 2),
    result(8, 4, 3),
  ];
  const positions = (rows: SessionResults[]) =>
    rows.map((r) => [r.CarIdx, r.Position, r.ClassPosition]);

  it('renumbers with the excluded car at P1', () => {
    expect(positions(withoutExcluded(field, new Set([5]), sameClass))).toEqual([
      [6, 1, 0],
      [7, 2, 1],
      [8, 3, 2],
    ]);
  });

  it('renumbers with the excluded car mid-field', () => {
    expect(positions(withoutExcluded(field, new Set([7]), sameClass))).toEqual([
      [5, 1, 0],
      [6, 2, 1],
      [8, 3, 2],
    ]);
  });

  it('leaves the order alone with the excluded car last', () => {
    expect(positions(withoutExcluded(field, new Set([8]), sameClass))).toEqual([
      [5, 1, 0],
      [6, 2, 1],
      [7, 3, 2],
    ]);
  });

  it('keeps the other fields of each row', () => {
    expect(withoutExcluded(field, new Set([5]), sameClass)[0]).toEqual({
      ...field[1],
      Position: 1,
      ClassPosition: 0,
    });
  });

  it('removes a class the excluded car had to itself', () => {
    const classes = new Map([
      [5, 1],
      [6, 2],
      [7, 1],
      [8, 2],
    ]);
    const multi = [
      result(6, 1, 0),
      result(5, 2, 0),
      result(7, 3, 1),
      result(8, 4, 1),
    ];
    expect(
      positions(withoutExcluded(multi, new Set([5]), (i) => classes.get(i)))
    ).toEqual([
      [6, 1, 0],
      [7, 2, 0],
      [8, 3, 1],
    ]);
  });

  it('renumbers only the class the excluded car shares', () => {
    const classes = new Map([
      [5, 1],
      [6, 2],
      [7, 1],
      [8, 2],
      [9, 3],
    ]);
    const multi = [
      result(5, 1, 0),
      result(6, 2, 0),
      result(9, 3, 0),
      result(7, 4, 1),
      result(8, 5, 1),
    ];
    expect(
      positions(withoutExcluded(multi, new Set([9]), (i) => classes.get(i)))
    ).toEqual([
      [5, 1, 0],
      [6, 2, 0],
      [7, 3, 1],
      [8, 4, 1],
    ]);
  });
});

describe('competitorsOnly', () => {
  it('returns the results untouched with nothing excluded', () => {
    const results = [result(0, 1, 0)];
    expect(competitorsOnly(results, undefined, [])).toBe(results);
    expect(competitorsOnly(results, EMPTY_EXCLUDED_IDXS, [])).toBe(results);
    expect(competitorsOnly(undefined, new Set([0]), [])).toBeUndefined();
  });

  it('renumbers class positions by each driver class', () => {
    const drivers = [driver(0, 1, 1), driver(1, 1, 2), driver(2, 1, 1)];
    const results = [result(0, 1, 0), result(1, 2, 0), result(2, 3, 1)];
    expect(
      competitorsOnly(results, new Set([0]), drivers)?.map((r) => [
        r.CarIdx,
        r.Position,
        r.ClassPosition,
      ])
    ).toEqual([
      [1, 1, 0],
      [2, 2, 0],
    ]);
  });
});

describe('reRankClassPositions', () => {
  it('numbers each class 1..n in its current order', () => {
    const row = (carIdx: number, classPosition?: number) =>
      ({ carIdx, classPosition }) as Standings;
    const unchanged = row(1, 1);
    const ranked = reRankClassPositions([
      ['1', [unchanged, row(2, 3), row(3, 4)]],
      ['2', [row(4, 2), row(5, undefined)]],
    ]);
    expect(
      ranked.map(([id, rows]) => [id, rows.map((r) => r.classPosition)])
    ).toEqual([
      ['1', [1, 2, 3]],
      ['2', [1, 2]],
    ]);
    expect(ranked[0][1][0]).toBe(unchanged);
  });
});

describe('excludedStandings', () => {
  it('clears positions and fastest-lap marks', () => {
    const [row] = excludedStandings([
      {
        carIdx: 3,
        position: 1,
        classPosition: 1,
        delta: 2,
        hasFastestTime: true,
        lastTimeState: 'session-fastest',
      } as Standings,
    ]);
    expect(row).toMatchObject({
      carIdx: 3,
      position: undefined,
      classPosition: undefined,
      delta: undefined,
      hasFastestTime: false,
      lastTimeState: 'personal-best',
    });
  });
});
