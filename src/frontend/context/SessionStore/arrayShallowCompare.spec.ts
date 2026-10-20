import { describe, expect, it } from 'vitest';
import { arrayShallowCompare } from './arrayShallowCompare';
import type { Driver } from '@irdashies/types';

describe('arrayShallowCompare', () => {
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

describe('arrayShallowCompare across the IPC clone', () => {
  /** What the renderer actually receives: a fresh object graph every publish. */
  const published = <T>(value: T): T => structuredClone(value);

  const lmuDriver = () => ({
    UserName: 'Alice',
    CarIdx: 3,
    LmuRating: {
      driverRank: 'Gold',
      driverTier: 2,
      safetyRank: 'Silver',
      badge: 'sr-clean',
      countryCode: 'FR',
    },
  });

  it('sees an unchanged LMU grid as unchanged', () => {
    // The bug: `shallow` compares LmuRating by identity, and the clone makes
    // it a new object every publish -- so this was false on every single
    // session publish and the standings pipeline re-ran each time.
    const a = published([lmuDriver()]) as unknown[];
    const b = published([lmuDriver()]) as unknown[];

    expect(a[0]).not.toBe(b[0]);
    expect(arrayShallowCompare(a, b)).toBe(true);
  });

  it('still reports a rating that really changed', () => {
    const before = published([lmuDriver()]) as unknown[];
    const after = published([
      {
        ...lmuDriver(),
        LmuRating: { ...lmuDriver().LmuRating, driverTier: 3 },
      },
    ]) as unknown[];

    expect(arrayShallowCompare(before, after)).toBe(false);
  });

  it('reports a rating gained or lost', () => {
    const withRating = published([lmuDriver()]) as unknown[];
    const without = published([
      { UserName: 'Alice', CarIdx: 3, LmuRating: undefined },
    ]) as unknown[];

    expect(arrayShallowCompare(withRating, without)).toBe(false);
  });

  it('still reports a changed top-level field', () => {
    const before = published([lmuDriver()]) as unknown[];
    const after = published([{ ...lmuDriver(), CarIdx: 4 }]) as unknown[];

    expect(arrayShallowCompare(before, after)).toBe(false);
  });

  it('reports a driver gaining a field', () => {
    const before = published([{ UserName: 'Alice' }]) as unknown[];
    const after = published([{ UserName: 'Alice', CarIdx: 1 }]) as unknown[];

    expect(arrayShallowCompare(before, after)).toBe(false);
  });

  it('does not look past the second level', () => {
    // Bounded on purpose. A third level compares by identity, which after a
    // clone means "not equal" -- fine, because nothing in a session payload
    // nests that far, and an unbounded compare would trade one cost for
    // another.
    const deep = () => ({ a: { b: { c: 1 } } });
    expect(arrayShallowCompare([published(deep())], [published(deep())])).toBe(
      false
    );
  });

  it('is unchanged for a grid of primitives, as iRacing has', () => {
    const a = published([{ UserName: 'Alice', CarIdx: 1 }]) as unknown[];
    const b = published([{ UserName: 'Alice', CarIdx: 1 }]) as unknown[];
    expect(arrayShallowCompare(a, b)).toBe(true);
  });
});
