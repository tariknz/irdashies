import { describe, expect, it } from 'vitest';
import { lmuRatingFor } from './lmuRatingFor';

describe('lmuRatingFor', () => {
  const full = {
    driverRank: 'Gold' as const,
    driverTier: 3,
    safetyRank: 'Silver' as const,
    safetyTier: 1,
    countryCode: 'FR',
  };

  it('passes the rating through when flags are on', () => {
    expect(lmuRatingFor(full, true)).toBe(full);
  });

  it('strips the country when flags are off, keeping the ranks', () => {
    const result = lmuRatingFor(full, false);
    expect(result?.countryCode).toBeUndefined();
    expect(result?.driverRank).toBe('Gold');
    expect(result?.safetyRank).toBe('Silver');
  });

  it('returns undefined when the country was all there was', () => {
    // BadgeCell branches on the rating being present, so an object with
    // every field cleared would suppress the iRacing badge and draw nothing.
    expect(lmuRatingFor({ countryCode: 'FR' }, false)).toBeUndefined();
  });

  it('keeps a badge-only rating when flags are off', () => {
    expect(lmuRatingFor({ badge: 'lemans', countryCode: 'FR' }, false)).toEqual(
      { badge: 'lemans' }
    );
  });

  it('passes undefined through', () => {
    expect(lmuRatingFor(undefined, true)).toBeUndefined();
    expect(lmuRatingFor(undefined, false)).toBeUndefined();
  });
});
