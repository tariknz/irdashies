import { describe, expect, it } from 'vitest';
import {
  FASTER_CARS_DISPLAY_ITEMS,
  normalizeFasterCarsDisplayOrder,
} from './displayOrder';

describe('normalizeFasterCarsDisplayOrder', () => {
  it('defaults to name, rating, distance', () => {
    expect(normalizeFasterCarsDisplayOrder(undefined)).toEqual([
      'driverName',
      'badge',
      'distance',
    ]);
    expect(FASTER_CARS_DISPLAY_ITEMS).toEqual([
      'driverName',
      'badge',
      'distance',
    ]);
  });

  it('keeps a saved order', () => {
    expect(
      normalizeFasterCarsDisplayOrder(['distance', 'driverName', 'badge'])
    ).toEqual(['distance', 'driverName', 'badge']);
  });

  it('appends items the saved order is missing', () => {
    expect(normalizeFasterCarsDisplayOrder(['distance'])).toEqual([
      'distance',
      'driverName',
      'badge',
    ]);
  });

  it('drops unknown, duplicate and non-string entries', () => {
    expect(
      normalizeFasterCarsDisplayOrder(['badge', 'class', 3, 'badge', null])
    ).toEqual(['badge', 'driverName', 'distance']);
  });

  it('ignores a value that is not a list', () => {
    expect(normalizeFasterCarsDisplayOrder('distance')).toEqual([
      'driverName',
      'badge',
      'distance',
    ]);
  });
});
