import { describe, expect, it } from 'vitest';
import { COLUMN_LABELS } from '../frontend/components/Standings/Standings';
import {
  hiddenRatingColumns,
  RATING_COLUMN_IDS,
  SIMULATOR_IDS,
  simulatorHasDriverRatings,
} from './simulators';

describe('simulatorHasDriverRatings', () => {
  it('reports iRacing as having ratings and LMU as not', () => {
    expect(simulatorHasDriverRatings('iracing')).toBe(true);
    expect(simulatorHasDriverRatings('lmu')).toBe(false);
  });

  it('shows ratings while no simulator has been detected', () => {
    // The active simulator is null before detection settles, and deliberately
    // outlives a disconnect. Hiding on uncertainty would blank the column
    // every time a session ends.
    expect(simulatorHasDriverRatings(null)).toBe(true);
    expect(simulatorHasDriverRatings(undefined)).toBe(true);
  });

  it('answers for every known simulator', () => {
    // A new simulator added to SIMULATOR_IDS without an entry here would read
    // as undefined and silently hide the column.
    for (const id of SIMULATOR_IDS) {
      expect(typeof simulatorHasDriverRatings(id)).toBe('boolean');
    }
  });
});

describe('RATING_COLUMN_IDS', () => {
  it('names only columns that exist', () => {
    // A typo would hide nothing at all, and do it silently -- the same
    // reasoning as the widget-id assertion in simWidgetSupport.spec.ts.
    const known = new Set(Object.keys(COLUMN_LABELS));
    for (const id of RATING_COLUMN_IDS) {
      expect(known).toContain(id);
    }
  });
});

/**
 * Which rating columns each simulator may show.
 *
 * This was one boolean per simulator, and LMU's was false because LMU had no
 * ratings. Once it did, the flag still hid the column that holds them -- so
 * the ranks were fetched, matched, published and then filtered out of the row
 * before any ordering ran. Nothing logged it, every setting looked right, and
 * the flags beside them rendered from the same object.
 */
describe('hiddenRatingColumns', () => {
  it('shows LMU rating columns and hides none of them', () => {
    const hidden = hiddenRatingColumns('lmu');

    expect(hidden.has('badge')).toBe(false);
    expect(hidden.has('lmuBadge')).toBe(false);
    expect(hidden.has('iratingChange')).toBe(false);
  });

  it('hides the LMU-only column on iRacing', () => {
    const hidden = hiddenRatingColumns('iracing');

    expect(hidden.has('lmuBadge')).toBe(true);
    expect(hidden.has('badge')).toBe(false);
    expect(hidden.has('iratingChange')).toBe(false);
  });

  it('hides nothing before a simulator is detected', () => {
    for (const sim of [undefined, null]) {
      expect([...hiddenRatingColumns(sim)]).toEqual([]);
    }
  });

  it('only ever hides ids that are rating columns', () => {
    for (const sim of ['iracing', 'lmu', undefined] as const) {
      for (const id of hiddenRatingColumns(sim)) {
        expect(RATING_COLUMN_IDS).toContain(id);
      }
    }
  });
});
