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
