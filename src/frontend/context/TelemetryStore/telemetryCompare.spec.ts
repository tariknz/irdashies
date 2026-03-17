import { describe, it, expect } from 'vitest';
import {
  telemetryCompare,
  arrayCompare,
  arrayCompareRounded,
} from './telemetryCompare';
import type { TelemetryVar } from '@irdashies/types';

describe('telemetryCompare', () => {
  it('should return true if both inputs are undefined', () => {
    expect(telemetryCompare(undefined, undefined)).toBe(true);
  });

  it('should return false if one input is undefined', () => {
    const a = { value: [1, 2, 3] } as TelemetryVar<number[]>;
    expect(telemetryCompare(a, undefined)).toBe(false);
    expect(telemetryCompare(undefined, a)).toBe(false);
  });

  it('should return false if array lengths differ', () => {
    const a = { value: [1, 2, 3] } as TelemetryVar<number[]>;
    const b = { value: [1, 2] } as TelemetryVar<number[]>;
    expect(telemetryCompare(a, b)).toBe(false);
  });

  it('should return false if array values differ', () => {
    const a = { value: [1, 2, 3] } as TelemetryVar<number[]>;
    const b = { value: [1, 2, 4] } as TelemetryVar<number[]>;
    expect(telemetryCompare(a, b)).toBe(false);
  });

  it('should return true if array values are the same', () => {
    const a = { value: [1, 2, 3] } as TelemetryVar<number[]>;
    const b = { value: [1, 2, 3] } as TelemetryVar<number[]>;
    expect(telemetryCompare(a, b)).toBe(true);
  });

  it('should return true if both arrays are empty', () => {
    const a = { value: [] as number[] } as TelemetryVar<number[]>;
    const b = { value: [] as number[] } as TelemetryVar<number[]>;
    expect(telemetryCompare(a, b)).toBe(true);
  });

  it('should return false if boolean array values differ', () => {
    const a = { value: [true, false, true] } as TelemetryVar<boolean[]>;
    const b = { value: [true, true, false] } as TelemetryVar<boolean[]>;
    expect(telemetryCompare(a, b)).toBe(false);
  });

  it('should return true if boolean array values are the same', () => {
    const a = { value: [true, false, true] } as TelemetryVar<boolean[]>;
    const b = { value: [true, false, true] } as TelemetryVar<boolean[]>;
    expect(telemetryCompare(a, b)).toBe(true);
  });
});

describe('arrayCompare', () => {
  it('should return true if both are undefined', () => {
    expect(arrayCompare(undefined, undefined)).toBe(true);
  });

  it('should return false if only one is undefined', () => {
    expect(arrayCompare([1, 2], undefined)).toBe(false);
    expect(arrayCompare(undefined, [1, 2])).toBe(false);
  });

  it('should return false if lengths differ', () => {
    expect(arrayCompare([1, 2, 3], [1, 2])).toBe(false);
  });

  it('should return true for equal arrays', () => {
    expect(arrayCompare([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('should return false for arrays with differing values', () => {
    expect(arrayCompare([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('should return true for two empty arrays', () => {
    expect(arrayCompare([], [])).toBe(true);
  });

  it('should use strict equality for element comparison', () => {
    expect(arrayCompare(['1'], [1 as unknown as string])).toBe(false);
  });
});

describe('arrayCompareRounded', () => {
  it('should return true if both are undefined', () => {
    expect(arrayCompareRounded(2, undefined, undefined)).toBe(true);
  });

  it('should return false if only one is undefined', () => {
    expect(arrayCompareRounded(2, [1.0], undefined)).toBe(false);
    expect(arrayCompareRounded(2, undefined, [1.0])).toBe(false);
  });

  it('should return false if lengths differ', () => {
    expect(arrayCompareRounded(2, [1.0, 2.0], [1.0])).toBe(false);
  });

  it('should return true for values equal at given precision', () => {
    expect(arrayCompareRounded(2, [1.001, 2.004], [1.002, 2.003])).toBe(true);
  });

  it('should return false for values differing beyond precision', () => {
    expect(arrayCompareRounded(2, [1.001, 2.004], [1.001, 2.014])).toBe(false);
  });

  it('should return true for exactly equal values', () => {
    expect(arrayCompareRounded(4, [0.1234, 0.5678], [0.1234, 0.5678])).toBe(
      true
    );
  });

  it('should return true for two empty arrays', () => {
    expect(arrayCompareRounded(2, [], [])).toBe(true);
  });

  it('should respect precision boundary correctly', () => {
    // 0.005 rounds to 0.01 at precision 2, 0.004 rounds to 0.00
    expect(arrayCompareRounded(2, [0.004], [0.005])).toBe(false);
    expect(arrayCompareRounded(2, [0.004], [0.004])).toBe(true);
  });
});
