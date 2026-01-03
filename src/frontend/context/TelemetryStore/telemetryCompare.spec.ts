import { describe, it, expect } from 'vitest';
import { telemetryCompare } from './telemetryCompare';
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
