import { describe, expect, it } from 'vitest';
import carDataBundle from './frontend/assets/data/cars-bundle.json';
import { PIT_TABLE_ROWS } from './app/processors/pitStop/pitServiceRules';

/**
 * Keeps the pit regulations table in step with the Lovely car data. Lives at
 * the src root because app code may not import from the frontend folder.
 */
const lovelyCars = (
  carDataBundle as { cars: Record<string, { carClass: string }> }
).cars;

/** Lovely classes whose cars all belong to a row of the table. */
const COVERED_CLASSES = [
  'GTP',
  'LMP1',
  'LMP2',
  'LMP3',
  'GT1',
  'GT3',
  'GT4',
  'GTE',
  'TCR',
  'CUP',
  'F296',
  'CTS',
  'M2',
  'M2C',
  'GR86',
  'MX5',
  'CAT',
  'SR8',
  'SR10',
  'SCCA',
];

const tableCarIds = PIT_TABLE_ROWS.flatMap((row) => row.carIds);

describe('pit regulations table and Lovely car data', () => {
  it('only lists car ids the Lovely data knows', () => {
    const unknown = tableCarIds.filter((carId) => !(carId in lovelyCars));
    expect(unknown).toEqual([]);
  });

  it('lists each car in one row only', () => {
    expect(new Set(tableCarIds).size).toBe(tableCarIds.length);
  });

  it('assigns every Lovely car of a covered class to a row', () => {
    const listed = new Set(tableCarIds);
    const missing = Object.entries(lovelyCars)
      .filter(([, car]) => COVERED_CLASSES.includes(car.carClass))
      .map(([carId]) => carId)
      .filter((carId) => !listed.has(carId));
    expect(missing).toEqual([]);
  });
});
