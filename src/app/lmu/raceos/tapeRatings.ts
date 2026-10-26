import type { LmuDriverRating } from '@irdashies/types';
import logger from '../../logger';
import type { LmuTapeRestSource } from '../rest/tapeTransport';
import type { RaceosClient } from './client';
import { parseStoredRating, raceosUsername } from './parse';

/**
 * Driver ratings served from a tape, for replays.
 *
 * A replay cannot resolve ratings the live way. The lookup is authorised by a
 * Steam auth ticket the sim mints, and the recorder deliberately does not
 * capture that path -- a ticket is a live credential and a tape is a fixture
 * meant to be shared. So on a replay there is nothing to authenticate with and
 * no network call worth making.
 *
 * What makes badges possible anyway is that `anonymise` bakes them in: it
 * writes the ratings it finds in the app's cache into the tape as one REST
 * record on a reserved path, keyed by driver name. Those keys go through the
 * same name substitution as every other recorded body, so on an anonymised
 * tape they are the pseudonyms the snapshots carry and the join still works --
 * a replay shows the badges it was recorded with, under the renamed drivers.
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
 * than put malformed ratings into them. A tape baked when ratings were keyed
 * by Steam id reads as a map of ids that match no driver, which is harmless:
 * every lookup simply misses.
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
  for (const [name, rating] of Object.entries(payload)) {
    // Canonicalised on the way in as well: the keys were rewritten by the
    // anonymiser's text substitution, which has no reason to preserve the
    // trimming the lookup applied when they were first stored.
    const key = raceosUsername(name);
    // Each field is validated as a fresh record would be, so an unknown rank
    // or a mistyped tier cannot reach the renderer from a tape either.
    const parsed = parseStoredRating(rating);
    if (key && parsed) out.set(key, parsed);
  }
  return out;
};

export function createLmuTapeRatingClient(
  source: LmuTapeRestSource
): RaceosClient {
  /** Undefined until the record has been seen; the tape is read at most once. */
  let ratings: Map<string, LmuDriverRating> | undefined;
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
    //
    // Not reported: `get` runs once per driver per snapshot, so a log here
    // would run at tens of lines a second for exactly the tape someone would
    // be trying to read the log of. Run `lmu_replay anonymise --ratings` to
    // bake ratings into a tape that has none.
    if (body === null) return undefined;
    ratings = parse(body);
    return ratings;
  };

  return {
    get: (driverName) => load()?.get(raceosUsername(driverName)),
    // Nothing to ask: a tape holds everything it will ever hold.
    request: () => undefined,
    reset: () => {
      ratings = undefined;
    },
  };
}
