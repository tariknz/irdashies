import { describe, it, expect } from 'vitest';
import { GARAGE61_CAR_IDS, GARAGE61_TRACK_IDS } from './_GENERATED_ids';

/**
 * Guards the generator rather than the data: a regeneration that dropped rows,
 * mangled a column, or mapped two iRacing ids onto one Garage 61 entry would
 * otherwise ship a lookup that quietly links to the wrong car.
 */
describe('Garage 61 id tables', () => {
  const tables = [
    ['tracks', GARAGE61_TRACK_IDS],
    ['cars', GARAGE61_CAR_IDS],
  ] as const;

  it.each(tables)('%s map iRacing ids onto Garage 61 ids', (_name, table) => {
    const entries = Object.entries(table);
    expect(entries.length).toBeGreaterThan(100);

    for (const [iracingId, garage61Id] of entries) {
      expect(Number.isInteger(Number(iracingId))).toBe(true);
      expect(Number(iracingId)).toBeGreaterThan(0);
      expect(Number.isInteger(garage61Id)).toBe(true);
      expect(garage61Id).toBeGreaterThan(0);
    }
  });

  it.each(tables)(
    '%s never point two iRacing ids at one entry',
    (_n, table) => {
      const values = Object.values(table);
      expect(new Set(values).size).toBe(values.length);
    }
  );

  it('keeps each track layout separate', () => {
    // iRacing numbers every configuration separately and so does Garage 61.
    // Algarve Grand Prix, Grand Prix with chicanes and Moto are 509, 510 and
    // 511; collapsing them would put a lap from the wrong layout on screen.
    const layouts = [509, 510, 511].map((id) => GARAGE61_TRACK_IDS[id]);
    expect(layouts.every((id) => id !== undefined)).toBe(true);
    expect(new Set(layouts).size).toBe(3);
  });

  it('has no id for something newer than the snapshot', () => {
    expect(GARAGE61_TRACK_IDS[999999]).toBeUndefined();
    expect(GARAGE61_CAR_IDS[999999]).toBeUndefined();
  });
});
