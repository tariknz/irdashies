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
