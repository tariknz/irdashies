import { describe, expect, it } from 'vitest';
import { calculateManufacturerCounts } from './useManufacturerCounts';

const driver = (
  carIdx: number,
  carId: number,
  carClassId = 1,
  overrides: Partial<{
    CarIsPaceCar: number;
    IsSpectator: number;
  }> = {}
) => ({
  CarIdx: carIdx,
  CarID: carId,
  CarClassID: carClassId,
  CarIsPaceCar: 0,
  IsSpectator: 0,
  ...overrides,
});

describe('calculateManufacturerCounts', () => {
  it('counts the complete class roster independently of visible standings', () => {
    const result = calculateManufacturerCounts(
      [
        driver(0, 56),
        driver(1, 56),
        driver(2, 56),
        driver(3, 67),
        driver(4, 67),
        driver(5, 55),
      ],
      5
    );

    expect(result['1'].counts.map(({ count }) => count)).toEqual([3, 2, 1]);
    expect(result['1'].playerEntry).toEqual({ carId: 55, count: 1 });
  });

  it('groups counts per class and excludes non-competitors', () => {
    const result = calculateManufacturerCounts(
      [
        driver(0, 56, 1),
        driver(1, 67, 2),
        driver(2, 56, 1, { CarIsPaceCar: 1 }),
        driver(3, 67, 2, { IsSpectator: 1 }),
      ],
      0
    );

    expect(result['1'].counts).toEqual([{ carId: 56, count: 1 }]);
    expect(result['1'].playerEntry).toEqual({ carId: 56, count: 1 });
    expect(result['2'].counts).toEqual([{ carId: 67, count: 1 }]);
  });
});
