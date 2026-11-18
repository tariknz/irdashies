import { describe, expect, it } from 'vitest';
import { arrayShallowCompare } from './arrayShallowCompare';
import type { Driver } from '@irdashies/types';
import { shallow } from 'zustand/shallow';

describe('arrayShallowCompare', () => {
  it('does not inspect elements when the array reference is unchanged', () => {
    const drivers: unknown[] = [];
    Object.defineProperty(drivers, 0, {
      get: () => {
        throw new Error('Unchanged array should not be traversed');
      },
    });

    expect(arrayShallowCompare(drivers, drivers)).toBe(true);
  });

  it('handles absent arrays and empty arrays', () => {
    expect(arrayShallowCompare(undefined, undefined)).toBe(true);
    expect(arrayShallowCompare(undefined, [])).toBe(false);
    expect(arrayShallowCompare([], undefined)).toBe(false);
    expect(arrayShallowCompare([], [])).toBe(true);
  });

  it('returns false when array values are different', () => {
    const a = [{ UserName: 'Alice' }] as Driver[];
    const b = [{ UserName: 'Bob' }] as Driver[];

    expect(arrayShallowCompare(a, b)).toBe(false);
  });

  it('returns true when both drivers are the same', () => {
    const a = [{ UserName: 'Alice' }] as Driver[];
    const b = [{ UserName: 'Alice' }] as Driver[];

    expect(arrayShallowCompare(a, b)).toBe(true);
  });
});

describe('element equality compatibility with Zustand shallow', () => {
  const shared = { rating: 2000 };
  const symbol = Symbol('metadata');
  const cases: [string, unknown, unknown][] = [
    ['NaN', NaN, NaN],
    ['signed zero', 0, -0],
    ['null and object', null, {}],
    ['undefined and null', undefined, null],
    ['reordered keys', { a: 1, b: 2 }, { b: 2, a: 1 }],
    ['different keys', { a: undefined }, { b: undefined }],
    ['missing key', { a: undefined }, {}],
    ['shared nested object', { a: shared }, { a: shared }],
    ['cloned nested object', { a: { rating: 2000 } }, { a: { rating: 2000 } }],
    ['symbol keys ignored', { a: 1, [symbol]: 1 }, { a: 1, [symbol]: 2 }],
    ['null prototypes', Object.assign(Object.create(null), { a: 1 }), { a: 1 }],
    ['arrays', [1, 2], [1, 2]],
    ['changed arrays', [1, 2], [2, 1]],
    ['sets', new Set([1, 2]), new Set([2, 1])],
    ['maps', new Map([['a', 1]]), new Map([['a', 1]])],
    ['changed maps', new Map([['a', 1]]), new Map([['a', 2]])],
    ['dates', new Date(0), new Date(1)],
    ['different prototypes', new Date(0), {}],
    [
      'non-enumerable counterpart',
      { a: 1 },
      Object.defineProperty({ b: 1 }, 'a', { value: 1 }),
    ],
    [
      'inherited counterpart',
      { toString: Object.prototype.toString },
      { b: 1 },
    ],
    [
      'iterable records',
      {
        *[Symbol.iterator]() {
          yield 1;
        },
      },
      {
        *[Symbol.iterator]() {
          yield 1;
        },
      },
    ],
  ];

  it.each(cases)('matches shallow for %s', (_name, a, b) => {
    expect(arrayShallowCompare([a], [b])).toBe(shallow(a, b));
    expect(arrayShallowCompare([b], [a])).toBe(shallow(b, a));
  });

  it('matches shallow across a deterministic grid of plain record values', () => {
    const values = [undefined, null, NaN, 0, -0, 1, '', 'Alice', shared];
    const records = values.flatMap((value) => [
      { a: value },
      { b: value },
      { a: value, b: shared },
    ]);
    for (const a of records) {
      for (const b of records) {
        expect(arrayShallowCompare([a], [b])).toBe(shallow(a, b));
      }
    }
  });
});

describe('arrayShallowCompare across the IPC clone', () => {
  /** What the renderer actually receives: a fresh object graph every publish. */
  const published = <T>(value: T): T => structuredClone(value);

  const lmuDriver = () => ({
    UserName: 'Alice',
    CarIdx: 3,
    LmuRating: { driverRank: 'Gold', driverTier: 2, countryCode: 'FR' },
  });

  it('cannot see an unchanged LMU grid as unchanged, and that is accepted', () => {
    // `shallow` compares LmuRating by identity and the clone makes it a new
    // object, so this is false on every LMU session publish. Comparing a level
    // deeper fixes it and was reverted: the rebuild it would have avoided
    // measured under 8ms, and the deeper compare cost more than it saved.
    // Documented rather than fixed so the next attempt starts from the
    // measurement instead of the reasoning.
    const a = published([lmuDriver()]) as unknown[];
    const b = published([lmuDriver()]) as unknown[];

    expect(arrayShallowCompare(a, b)).toBe(false);
  });

  it('sees an unchanged grid of primitives as unchanged, as iRacing has', () => {
    const a = published([{ UserName: 'Alice', CarIdx: 1 }]) as unknown[];
    const b = published([{ UserName: 'Alice', CarIdx: 1 }]) as unknown[];

    expect(arrayShallowCompare(a, b)).toBe(true);
  });

  it('reports a changed field, and a changed length', () => {
    const before = published([{ UserName: 'Alice', CarIdx: 3 }]) as unknown[];
    expect(
      arrayShallowCompare(
        before,
        published([{ UserName: 'Alice', CarIdx: 4 }]) as unknown[]
      )
    ).toBe(false);
    expect(arrayShallowCompare(before, [])).toBe(false);
  });
});
