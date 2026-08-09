import type { Driver } from '@irdashies/types';
import { describe, expect, it } from 'vitest';
import { getCarClassDisplayName } from './getCarClassDisplayName';

const driver = (overrides: Partial<Driver>): Driver =>
  ({
    CarClassID: 4011,
    CarClassShortName: null,
    CarID: 132,
    CarScreenNameShort: 'BMW M4 GT3 EVO',
    ...overrides,
  }) as Driver;

describe('getCarClassDisplayName', () => {
  it('prefers a class name supplied by iRacing', () => {
    expect(
      getCarClassDisplayName(4011, [driver({ CarClassShortName: 'GT3 2025' })])
    ).toBe('GT3 2025');
  });

  it.each([
    [4011, [132, 133, 156, 169, 173, 184, 185, 188, 194, 206], 'GT3'],
    [2523, [128], 'LMP2'],
    [4029, [159, 168, 170, 174, 196], 'GTP'],
  ])('infers class %s from its mapped cars', (classId, carIds, expected) => {
    expect(
      getCarClassDisplayName(
        classId,
        carIds.map((CarID) => driver({ CarClassID: classId, CarID }))
      )
    ).toBe(expected);
  });

  it('uses the car name for an unmapped single-model class', () => {
    expect(
      getCarClassDisplayName(9999, [
        driver({
          CarClassID: 9999,
          CarID: 999,
          CarScreenNameShort: 'Example Cup Car',
        }),
      ])
    ).toBe('Example Cup Car');
  });

  it('uses the class ID when a multi-model class cannot be inferred', () => {
    expect(
      getCarClassDisplayName(9999, [
        driver({ CarClassID: 9999, CarID: 998 }),
        driver({ CarClassID: 9999, CarID: 999 }),
      ])
    ).toBe('Class 9999');
  });
});
