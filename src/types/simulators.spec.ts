import { describe, expect, it } from 'vitest';
import { COLUMN_LABELS } from '../frontend/components/Standings/Standings';
import {
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
