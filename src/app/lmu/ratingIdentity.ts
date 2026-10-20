import type { LmuDriverRating } from '@irdashies/types';

/**
 * Keeps a driver's rating object the same object while its contents are the
 * same, so the session snapshot stays referentially stable.
 *
 * The renderer compares `DriverInfo.Drivers` with `arrayShallowCompare`, which
 * is `shallow` per driver -- own keys by `Object.is`. Every field on a driver
 * is a primitive except `LmuRating`, and the mapper built a fresh one on every
 * rebuild (`{ ...rating, countryCode }`). So no two consecutive snapshots ever
 * compared equal, `useSessionDrivers` handed back a new array twice a second,
 * and `createDriverStandings` re-ran the whole pipeline -- sorting, class
 * grouping, qualifying maps -- for a grid that had not changed.
 *
 * iRacing was never affected: its drivers carry no nested object, so `shallow`
 * saw only primitives and the array stayed stable. This is why the symptom was
 * LMU-only, and why it was easy to miss.
 *
 * Bridge-scoped rather than module-level, like `createRosterGate` and
 * `createLmuRestData`: the cache has to go away when LMU does, and a factory
 * makes that the caller's business rather than a hidden global.
 */

/** What the merge is keyed on: same inputs, same object back. */
interface CachedRating {
  rating: LmuDriverRating | undefined;
  countryCode: string | undefined;
  merged: LmuDriverRating | undefined;
}

export interface LmuRatingMerger {
  /**
   * The driver's rating with the sim's country folded in.
   *
   * The sim's own answer wins over the service's, being first-party and
   * present for everyone in the session.
   */
  merge(
    name: string,
    countryCode: string | undefined,
    rating: LmuDriverRating | undefined
  ): LmuDriverRating | undefined;
  reset(): void;
}

/**
 * Merges and remembers.
 *
 * Keyed on the rating object's identity rather than its contents, because the
 * rating client already hands out a stable object per driver and replaces it
 * only when the service answers again. So identity is exactly the right test:
 * a new object there means genuinely new data.
 */
export const createRatingMerger = (): LmuRatingMerger => {
  const cache = new Map<string, CachedRating>();

  return {
    merge(name, countryCode, rating) {
      const previous = cache.get(name);
      if (
        previous &&
        previous.rating === rating &&
        previous.countryCode === countryCode
      ) {
        return previous.merged;
      }

      let merged: LmuDriverRating | undefined;
      if (!rating) {
        merged = countryCode ? { countryCode } : undefined;
      } else if ((countryCode ?? rating.countryCode) === rating.countryCode) {
        // Nothing to fold in, so the rating client's own object goes through
        // untouched -- already stable, and one allocation fewer per driver.
        merged = rating;
      } else {
        merged = { ...rating, countryCode };
      }

      cache.set(name, { rating, countryCode, merged });
      return merged;
    },

    reset() {
      cache.clear();
    },
  };
};
