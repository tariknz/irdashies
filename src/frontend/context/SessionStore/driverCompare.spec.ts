import { describe, expect, it } from 'vitest';
import { driverListCompare } from './driverCompare';
import type { Driver } from '@irdashies/types';

describe('driverListCompare', () => {
  it('compares telemetry value arrays for equality to avoid unnecessary re-renders', () => {
    const a = [{ UserName: 'Alice' }] as Driver[];
    const b = [{ UserName: 'Bob' }] as Driver[];

    expect(driverListCompare(a, b)).toBe(false);
  });

  it('returns true when both drivers are the same', () => {
    const a = [{ UserName: 'Alice' }] as Driver[];
    const b = [{ UserName: 'Alice' }] as Driver[];

    expect(driverListCompare(a, b)).toBe(true);
  });
});
