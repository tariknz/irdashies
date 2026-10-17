import type { LmuDriverRating } from '@irdashies/types';
import logger from '../../logger';
import type { DriverRatingCache } from '../../storage/driverRatings';
import type { RaceosTransport } from './httpsJson';
import { parseRaceosPlayers } from './parse';

/**
 * Looks up LMU driver ratings from the sim's own ecosystem service.
 *
 * The credential chain is not obvious and is worth stating once:
 *
 *  1. LMU's local REST API issues a Steam auth session ticket for the
 *     signed-in user (`/rest/profile/getAuthSessionTicket`).
 *  2. That ticket is exchanged at the rating service for a bearer token.
 *  3. The token authorises a batched lookup of the Steam IDs on the grid.
 *
 * So ratings exist only while LMU is running and signed in through Steam.
 * There is no API key to configure and nothing for the user to set up --
 * and equally, no way to make this work offline or outside a session.
 *
 * Everything here is best-effort. A failed lookup leaves drivers unrated and
 * the standings render exactly as they do without it; nothing retries hard,
 * and a service that is down backs the client off rather than hammering it.
 *
 * All IO is injected, so the whole flow is testable with no network, no sim
 * and no clock.
 */

export const RACEOS_AUTH_URL = 'https://raceos.gg/authenticate';
export const RACEOS_PLAYERS_URL = 'https://raceos.gg/api/v1/players';

/** Steam IDs per lookup; the grid goes up in batches, not one at a time. */
export const RACEOS_BATCH_SIZE = 50;

/** Backoff after a failure, doubling to the ceiling. */
export const RACEOS_BACKOFF_MS = 30_000;
export const RACEOS_MAX_BACKOFF_MS = 15 * 60_000;

/** Re-exchange the ticket this long before the token is due to expire. */
const TOKEN_SKEW_MS = 60_000;

/** Assumed token life when the service does not state one. */
const DEFAULT_TOKEN_TTL_MS = 30 * 60_000;

export interface RaceosClientOptions {
  transport: RaceosTransport;
  cache: DriverRatingCache;
  /**
   * Fetches a Steam auth session ticket from LMU's local REST API. Resolves
   * undefined when the sim is not running or not signed in, which is an
   * ordinary state rather than an error.
   */
  fetchTicket: () => Promise<string | undefined>;
  /** Fired when ratings are newly resolved, so the session can republish. */
  onResolved?: () => void;
  now?: () => number;
}

export interface RaceosClient {
  /**
   * A rating already held for this Steam ID, or undefined.
   *
   * Synchronous and allocation-light: the session mapper calls it once per
   * driver while building a snapshot and must never await.
   */
  get(steamId: string): LmuDriverRating | undefined;
  /**
   * Queues any of these Steam IDs not already known or in flight. Returns at
   * once; answers land in the cache and `onResolved` fires.
   */
  request(steamIds: readonly string[]): void;
  /** Drops the token and the queue. The persistent cache is left intact. */
  reset(): void;
}

export function createRaceosClient({
  transport,
  cache,
  fetchTicket,
  onResolved,
  now = Date.now,
}: RaceosClientOptions): RaceosClient {
  let token: string | undefined;
  let tokenExpiry = 0;
  /** Queued or in flight, so a tick does not re-ask for the same ids. */
  const pending = new Set<string>();
  let draining = false;
  /** Nothing is attempted before this; set by the backoff on failure. */
  let notBefore = 0;
  let backoff = RACEOS_BACKOFF_MS;
  /**
   * The last thing said, so a state that persists is reported once.
   *
   * Everything here is driven off the session poll, so a plain log call would
   * repeat twice a second for as long as the condition held. Most of these
   * conditions are steady by nature -- no ticket, nothing left to ask for --
   * and the useful signal is the transition, not the repetition.
   */
  let lastNote: string | undefined;

  const note = (message: string) => {
    if (lastNote === message) return;
    lastNote = message;
    logger.info(`[raceos] ${message}`);
  };

  const fail = (what: string) => {
    notBefore = now() + backoff;
    // Not deduped: each failure moves the backoff, so each one is new news.
    logger.warn(`[raceos] ${what}; backing off ${Math.round(backoff / 1000)}s`);
    backoff = Math.min(backoff * 2, RACEOS_MAX_BACKOFF_MS);
  };

  const succeed = () => {
    backoff = RACEOS_BACKOFF_MS;
  };

  /** A valid bearer token, exchanging the sim's Steam ticket when needed. */
  const ensureToken = async (): Promise<string | undefined> => {
    if (token && now() < tokenExpiry - TOKEN_SKEW_MS) return token;

    const ticket = await fetchTicket();
    if (!ticket) {
      // Not running, or not signed in. No backoff: the service has not
      // misbehaved, there is simply nothing to ask with.
      //
      // Said out loud because this is the likeliest reason for no badges and
      // it used to be the one state that logged nothing at all -- leaving "the
      // sim serves no ticket endpoint" and "everything worked, nobody is
      // rated" indistinguishable from the outside.
      note(
        'No Steam auth ticket from LMU, so no ratings can be looked up. ' +
          'The sim must be running and signed in to Steam; see ticket.ts for ' +
          'why a replay never has one.'
      );
      return undefined;
    }
    note('Got a Steam auth ticket from LMU; exchanging it for a token');

    const response = await transport({
      url: RACEOS_AUTH_URL,
      method: 'POST',
      body: { ticket },
    });
    if (!response.ok) {
      fail(`authentication failed (${response.reason})`);
      return undefined;
    }

    try {
      const payload = JSON.parse(response.body) as Record<string, unknown>;
      const value =
        typeof payload.accessToken === 'string'
          ? payload.accessToken
          : typeof payload.token === 'string'
            ? payload.token
            : undefined;
      if (!value) {
        fail('authentication returned no token');
        return undefined;
      }
      const ttl =
        typeof payload.expiresIn === 'number' && payload.expiresIn > 0
          ? payload.expiresIn * 1000
          : DEFAULT_TOKEN_TTL_MS;
      token = value;
      tokenExpiry = now() + ttl;
      succeed();
      note(
        `Authenticated with the rating service; token valid for ${Math.round(ttl / 1000)}s`
      );
      return token;
    } catch {
      fail('authentication returned unreadable JSON');
      return undefined;
    }
  };

  const lookupBatch = async (ids: string[], bearer: string) => {
    const response = await transport({
      url: `${RACEOS_PLAYERS_URL}?steamIds=${ids.join(',')}`,
      token: bearer,
    });
    if (!response.ok) {
      if (response.status === 401) {
        // Token rejected: drop it so the next pass re-exchanges the ticket.
        token = undefined;
      }
      fail(`player lookup failed (${response.reason})`);
      return;
    }

    let found: Map<string, LmuDriverRating>;
    try {
      found = parseRaceosPlayers(JSON.parse(response.body));
    } catch {
      fail('player lookup returned unreadable JSON');
      return;
    }

    succeed();
    for (const id of ids) {
      // An id the service did not answer for is cached as a miss. That is
      // what stops a grid of AI being re-asked every single session.
      cache.set(id, found.get(id));
    }
    // Not deduped: one line per completed batch is the record of what the
    // service actually answered, and a repeat means a new batch.
    logger.info(
      `[raceos] Resolved ${found.size}/${ids.length} driver ratings (cache ${cache.size()})`
    );
    if (found.size > 0) onResolved?.();
  };

  /** Drains `pending` in batches. Only ever one of these at a time. */
  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (pending.size > 0) {
        if (now() < notBefore) return;
        const bearer = await ensureToken();
        if (!bearer) return;

        const batch = [...pending].slice(0, RACEOS_BATCH_SIZE);
        // Cleared before the request, not after: a failed batch caches
        // nothing and its ids are re-queued by the next session tick.
        // Holding them pending across a failure would wedge the queue.
        for (const id of batch) pending.delete(id);
        await lookupBatch(batch, bearer);
      }
    } catch (e) {
      logger.warn('[raceos] Rating lookup threw', e);
    } finally {
      draining = false;
    }
  };

  return {
    get(steamId) {
      return cache.get(steamId)?.rating;
    },

    request(steamIds) {
      if (now() < notBefore) {
        note(
          `Holding off on ${steamIds.length} grid Steam ids until the backoff expires`
        );
        return;
      }
      if (steamIds.length === 0) {
        // An all-AI grid, or a sim reporting no ids. Worth saying, because the
        // standings look identical to a lookup that failed.
        note('No human Steam ids on the grid; nothing to look up');
        return;
      }
      let queued = 0;
      for (const id of steamIds) {
        if (!id || pending.has(id)) continue;
        // A remembered miss counts as known: not re-asking is the point.
        if (cache.get(id) !== undefined) continue;
        pending.add(id);
        queued += 1;
      }
      // Distinguishes the three states that all render as a bare standings
      // row: asking now, already answered, and still waiting on a batch.
      note(
        queued > 0
          ? `Looking up ${queued} of ${steamIds.length} grid Steam ids`
          : pending.size > 0
            ? `All ${steamIds.length} grid Steam ids are queued or in flight`
            : `All ${steamIds.length} grid Steam ids already known from cache`
      );
      if (queued > 0) void drain();
    },

    reset() {
      token = undefined;
      tokenExpiry = 0;
      pending.clear();
      notBefore = 0;
      backoff = RACEOS_BACKOFF_MS;
      // So the next session reports its state afresh rather than staying
      // quiet because the last one had already said the same thing.
      lastNote = undefined;
    },
  };
}
