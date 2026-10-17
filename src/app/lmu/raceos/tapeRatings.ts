import type { LmuDriverRating } from '@irdashies/types';
import logger from '../../logger';
import type { LmuTapeRestSource } from '../rest/tapeTransport';
import type { RaceosClient } from './client';

/**
 * Driver ratings served from a tape, for replays.
 *
 * A replay cannot resolve ratings the live way. The lookup is authorised by a
 * Steam auth ticket the sim mints, and the recorder deliberately does not
 * capture that path -- a ticket is a live credential and a tape is a fixture
 * meant to be shared. So on a replay there is nothing to authenticate with and
 * no network call worth making.
 *
 * What makes badges possible anyway is that `anonymise` bakes them in: it maps
 * each real Steam id to a synthetic one and writes the ratings it finds in the
 * app's cache under the new ids, as one REST record on a reserved path. The
 * ids in the snapshots match, so the join still works and a replay shows the
 * badges it was recorded with -- without carrying a single real identity.
 *
 * This implements the same interface as the live client so the bridge only
 * chooses between them. `request` is a no-op because everything a tape will
 * ever know is already in it.
 */

/**
 * The tape path the ratings are stored under.
 *
 * Not a real endpoint; LMU serves nothing here. Must match
 * kReplayRatingsPath in native/replay/lmu_replay_main.cpp, which
 * rest/recorderParity.spec.ts checks.
 */
export const REPLAY_RATINGS_PATH = '/irdashies/replay/driver-ratings';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Reads the baked body into a map.
 *
 * Shapes are checked rather than trusted. The body was written by the
 * anonymiser out of a cache file on someone else's machine, so a tape from an
 * older build -- or a hand-edited one -- must leave the standings alone rather
 * than put malformed ratings into them.
 */
const parse = (body: string): Map<string, LmuDriverRating> => {
  const out = new Map<string, LmuDriverRating>();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    logger.warn('[raceos] Baked driver ratings are not readable JSON');
    return out;
  }
  if (!isRecord(payload)) return out;
  for (const [steamId, rating] of Object.entries(payload)) {
    if (isRecord(rating)) out.set(steamId, rating as LmuDriverRating);
  }
  return out;
};

export function createLmuTapeRatingClient(
  source: LmuTapeRestSource
): RaceosClient {
  /** Undefined until the record has been seen; the tape is read at most once. */
  let ratings: Map<string, LmuDriverRating> | undefined;
  /**
   * Whether the absence has been reported.
   *
   * `get` runs once per driver per snapshot, so an unguarded log here would
   * run at tens of lines a second for a tape with no ratings in it -- which is
   * exactly the tape someone would be trying to read the log of.
   */
  let warnedMissing = false;

  const load = (): Map<string, LmuDriverRating> | undefined => {
    if (ratings) return ratings;
    let body: string | null;
    try {
      body = source.readRest(REPLAY_RATINGS_PATH);
    } catch {
      // The snapshot path reports a broken tape far more loudly than this
      // could, and a replay without badges is still a usable replay.
      return undefined;
    }
    // A tape with no ratings record -- one recorded before this existed, or
    // anonymised with --no-ratings, or never anonymised at all -- reads null
    // forever. Left unmemoised so a looped tape picks the record up if it
    // arrives later in playback.
    if (body === null) {
      if (!warnedMissing) {
        warnedMissing = true;
        logger.info(
          '[raceos] This tape carries no baked driver ratings, so the replay ' +
            'shows no badges. Re-run `lmu_replay anonymise` with --ratings to ' +
            'bake them in.'
        );
      }
      return undefined;
    }
    ratings = parse(body);
    logger.info(`[raceos] Replaying ${ratings.size} baked driver ratings`);
    return ratings;
  };

  return {
    get: (steamId) => load()?.get(steamId),
    // Nothing to ask: a tape holds everything it will ever hold.
    request: () => undefined,
    reset: () => {
      ratings = undefined;
    },
  };
}
