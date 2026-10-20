import { describe, expect, it } from 'vitest';
import { shallow } from 'zustand/shallow';
import type { LmuDriverRating } from '@irdashies/types';
import { createRatingMerger } from './ratingIdentity';
import { mapLmuSession } from './mapSession';
import { fixture } from './rawSessionFixture';

const rating = (): LmuDriverRating => ({
  driverRank: 'Gold',
  driverTier: 2,
  safetyRank: 'Silver',
  safetyTier: 1,
  badge: 'sr-clean',
  countryCode: 'FR',
});

describe('createRatingMerger', () => {
  it('returns the same object while the inputs are unchanged', () => {
    // The country differs from the rating's, so the merge has to build a new
    // object -- which makes the cache the only thing preserving identity. With
    // an agreeing country the pass-through below would hide that.
    const merger = createRatingMerger();
    const held = rating();
    const first = merger.merge('A Driver', 'DE', held);
    const second = merger.merge('A Driver', 'DE', held);
    expect(second).toBe(first);
    expect(first?.countryCode).toBe('DE');
  });

  it('passes the rating through when there is nothing to fold in', () => {
    // The rating client's object is already stable between lookups, so an
    // unnecessary spread is an allocation and a lost identity.
    const merger = createRatingMerger();
    const held = rating();
    expect(merger.merge('A Driver', undefined, held)).toBe(held);
    expect(merger.merge('A Driver', 'FR', held)).toBe(held);
  });

  it('lets the sim’s country win over the service’s', () => {
    const merger = createRatingMerger();
    const merged = merger.merge('A Driver', 'DE', rating());
    expect(merged?.countryCode).toBe('DE');
    expect(merged?.driverRank).toBe('Gold');
  });

  it('gives a new object when the rating itself is replaced', () => {
    // Identity of the incoming rating is the test: the client replaces its
    // object only when the service has answered again.
    const merger = createRatingMerger();
    const first = merger.merge('A Driver', 'FR', rating());
    const second = merger.merge('A Driver', 'FR', {
      ...rating(),
      driverTier: 3,
    });
    expect(second).not.toBe(first);
    expect(second?.driverTier).toBe(3);
  });

  it('carries a country with no rating, and nothing with neither', () => {
    const merger = createRatingMerger();
    expect(merger.merge('A', 'FR', undefined)).toEqual({ countryCode: 'FR' });
    expect(merger.merge('B', undefined, undefined)).toBeUndefined();
  });

  it('keeps each driver apart', () => {
    const merger = createRatingMerger();
    const a = merger.merge('A', 'FR', rating());
    const b = merger.merge('B', 'DE', rating());
    expect(a).not.toBe(b);
    expect(merger.merge('A', 'FR', rating())).not.toBe(b);
  });

  it('forgets everything on reset, so a new sim run starts clean', () => {
    const merger = createRatingMerger();
    const held = rating();
    const first = merger.merge('A Driver', 'DE', held);
    merger.reset();
    expect(merger.merge('A Driver', 'DE', held)).not.toBe(first);
  });
});

/**
 * `arrayShallowCompare` per driver, which is what the renderer's
 * `useSessionDrivers` uses. Duplicated rather than imported because that
 * module is renderer-side and this spec runs over the main-process mapper --
 * the point is to hold the mapper to the comparison the renderer makes.
 */
const driversCompareEqual = (a: unknown[], b: unknown[]): boolean =>
  a.length === b.length && a.every((driver, i) => shallow(driver, b[i]));

describe('mapLmuSession driver identity', () => {
  it('publishes a grid the renderer can see is unchanged', () => {
    // The bug: LmuRating was rebuilt per driver per snapshot, so no two
    // consecutive publishes ever compared equal. useSessionDrivers handed back
    // a new array twice a second and createDriverStandings re-ran the whole
    // pipeline for a grid that had not moved.
    const merger = createRatingMerger();
    const held = rating();
    const ratingFor = () => held;
    const raw = fixture();
    // Nationalities that disagree with the rating's own country, which is the
    // case that forces a fresh object -- and so the case the renderer's
    // comparison used to fail on every single publish.
    const rest = {
      nationalities: Object.fromEntries(
        raw.drivers.map((driver) => [driver.name, 'DE'])
      ),
    };

    const first = mapLmuSession(raw, null, rest, ratingFor, merger);
    const second = mapLmuSession(raw, null, rest, ratingFor, merger);

    expect(
      driversCompareEqual(first.DriverInfo.Drivers, second.DriverInfo.Drivers)
    ).toBe(true);
  });

  it('still reports a grid that really changed', () => {
    const merger = createRatingMerger();
    const held = rating();
    const raw = fixture();

    const before = mapLmuSession(raw, null, {}, () => held, merger);
    const after = mapLmuSession(
      raw,
      null,
      {},
      () => ({ ...held, driverTier: 3 }),
      merger
    );

    expect(
      driversCompareEqual(before.DriverInfo.Drivers, after.DriverInfo.Drivers)
    ).toBe(false);
  });

  it('is stable without a merger too, now the spread is conditional', () => {
    // The plain path still allocates for a country the service did not have,
    // which is why the bridge passes a merger; but an unchanged rating with an
    // agreeing country no longer costs identity.
    const held = rating();
    const raw = fixture();
    const first = mapLmuSession(raw, null, {}, () => held);
    const second = mapLmuSession(raw, null, {}, () => held);
    expect(
      driversCompareEqual(first.DriverInfo.Drivers, second.DriverInfo.Drivers)
    ).toBe(true);
  });
});
