import type { LmuDriverRating } from '@irdashies/types';
import logger from '../../logger';
import type { DriverRatingCache } from '../../storage/driverRatings';
import type { RaceosTransport } from './httpsJson';
import { parseRaceosPlayers, raceosUsername } from './parse';

/**
 * Looks up LMU driver ratings from the sim's own ecosystem service.
 *
 * The credential chain is not obvious and is worth stating once:
 *
 *  1. LMU's local REST API issues a Steam auth session ticket for the
 *     signed-in user (`/rest/profile/getAuthSessionTicket`).
 *  2. That ticket is exchanged at the rating service for a bearer token.
 *  3. The token authorises a batched lookup of the driver names on the grid.
 *
 * So ratings exist only while LMU is running and signed in through Steam.
 * There is no API key to configure and nothing for the user to set up --
 * and equally, no way to make this work offline or outside a session.
 *
 * Keyed by driver name, not Steam id. The service takes a list of usernames,
 * and the sim reports 0 for every driver's Steam id anyway -- in shared memory
 * and over its own REST API alike -- so there is no id to key on even where
 * one would be preferable.
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

/** Names per lookup; the grid goes up in batches, not one at a time. */
export const RACEOS_BATCH_SIZE = 50;

/**
 * How long a newly queued name waits for company before it is looked up.
 *
 * LMU admits drivers one per session poll, so a grid filling in queued one
 * name at a time and each went out as its own request -- twenty in ten
 * seconds where one batch of twenty would have done. Waiting briefly lets a
 * burst collect into a single call.
 *
 * Bounded by RACEOS_QUEUE_MAX_WAIT_MS, or a grid admitting a driver every
 * half second would reset the wait forever and nothing would ever be asked.
 */
export const RACEOS_QUEUE_SETTLE_MS = 750;
export const RACEOS_QUEUE_MAX_WAIT_MS = 2500;

/** Backoff after a failure, doubling to the ceiling. */
export const RACEOS_BACKOFF_MS = 30_000;
export const RACEOS_MAX_BACKOFF_MS = 15 * 60_000;

/**
 * How long to wait before asking the sim for a ticket again when it had none.
 *
 * Not a backoff: nothing failed, and it neither grows nor logs. It only keeps
 * a session without a ticket -- a replay never has one -- from asking the sim
 * on every session poll.
 */
export const RACEOS_NO_TICKET_RETRY_MS = 5_000;

/** Re-exchange the ticket this long before the token is due to expire. */
const TOKEN_SKEW_MS = 60_000;

/** Assumed token life when the service does not state a usable expiry. */
const DEFAULT_TOKEN_TTL_MS = 30 * 60_000;

/** The game and platform the ticket was minted for; both are required. */
const RACEOS_GAME = 'lmu';
const RACEOS_PLATFORM = 'steam';

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
   * A rating already held for this driver name, or undefined.
   *
   * Synchronous and allocation-light: the session mapper calls it once per
   * driver while building a snapshot and must never await. The name is
   * canonicalised here, so callers pass whatever the sim gave them.
   */
  get(driverName: string): LmuDriverRating | undefined;
  /**
   * Queues any of these driver names not already known or in flight. Returns
   * at once; answers land in the cache and `onResolved` fires.
   */
  request(driverNames: readonly string[]): void;
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
  /** Queued, waiting to be put in a batch. */
  const pending = new Set<string>();
  /**
   * Handed to a request that has not come back yet.
   *
   * Separate from `pending` because a batch leaves `pending` before its
   * request is sent, and the token exchange in front of it can take most of a
   * second. For that whole window the names were in neither set, so the next
   * session poll -- which runs twice a second -- saw them as unknown and
   * queued them all over again. The grid went to the service twice.
   */
  const inflight = new Set<string>();
  let draining = false;
  /** Nothing is attempted before this; set by the backoff on failure. */
  let notBefore = 0;
  /** The pending settle timer, and when the current burst of queueing began. */
  let settleTimer: NodeJS.Timeout | undefined;
  let burstStartedAt: number | null = null;
  let backoff = RACEOS_BACKOFF_MS;
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
      // misbehaved, there is simply nothing to ask with -- and no log either,
      // because it is the steady state of every session without LMU signed in
      // to Steam. See ticket.ts for why a replay never has one.
      notBefore = now() + RACEOS_NO_TICKET_RETRY_MS;
      return undefined;
    }

    const response = await transport({
      url: RACEOS_AUTH_URL,
      method: 'POST',
      // `token` carries the ticket, and game and platform are both required:
      // without them the service answers "Invalid game specified".
      body: { token: ticket, game: RACEOS_GAME, platform: RACEOS_PLATFORM },
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
      // `expiresAt` is an absolute RFC 3339 instant, not a duration. Parsed
      // rather than trusted: a clock skewed against the service's would
      // otherwise either expire the token immediately or hold it past the end
      // of its life, and both read as an authentication that will not stick.
      const expiresAt = Date.parse(String(payload.expiresAt));
      const ttl =
        Number.isFinite(expiresAt) && expiresAt > now()
          ? expiresAt - now()
          : DEFAULT_TOKEN_TTL_MS;
      token = value;
      tokenExpiry = now() + ttl;
      succeed();
      return token;
    } catch {
      fail('authentication returned unreadable JSON');
      return undefined;
    }
  };

  const lookupBatch = async (usernames: string[], bearer: string) => {
    const response = await transport({
      url: RACEOS_PLAYERS_URL,
      // A POST with the names in the body, not a query string: the names are
      // free text and a grid of fifty would not fit comfortably in a URL.
      method: 'POST',
      body: { usernames },
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

    // The service answers with its own spelling of each username, which need
    // not be the one asked for. An exact match is tried first and a
    // case-insensitive one second, because a rating filed under a key no
    // driver will ever present is worth exactly as much as no rating -- and
    // that failure is silent, since the service did answer.
    const byLower = new Map<string, LmuDriverRating>();
    for (const [key, rating] of found) byLower.set(key.toLowerCase(), rating);

    let matched = 0;
    for (const name of usernames) {
      const rating = found.get(name) ?? byLower.get(name.toLowerCase());
      if (rating) matched += 1;
      // A name the service did not answer for is cached as a miss. That is
      // what stops a grid of AI being re-asked every single session.
      cache.set(name, rating);
    }

    if (matched === 0 && found.size > 0) {
      // The one combination that cannot be anything but a bug: answers came
      // back and none of them belong to anybody. Named on both sides, because
      // the difference between the two spellings is the whole diagnosis.
      logger.warn(
        `[raceos] The service answered for ${found.size} players and none ` +
          `matched the grid. Asked for e.g. ${JSON.stringify(usernames[0])}; ` +
          `answered for e.g. ${JSON.stringify([...found.keys()][0])}.`
      );
    }
    // Only a match changes a snapshot, so only a match is worth republishing
    // for; an answer that matched nothing would force a rebuild of the same
    // standings twice a second for as long as the grid held.
    if (matched > 0) onResolved?.();
  };

  /**
   * Waits for a burst of queueing to settle, then drains.
   *
   * Extended by each new name so joins arriving half a second apart collect
   * into one request, and capped so a grid that keeps filling is still asked
   * about rather than waiting indefinitely.
   */
  const scheduleDrain = () => {
    burstStartedAt ??= now();
    const waited = now() - burstStartedAt;
    if (waited >= RACEOS_QUEUE_MAX_WAIT_MS) {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = undefined;
      burstStartedAt = null;
      void drain();
      return;
    }
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(
      () => {
        settleTimer = undefined;
        burstStartedAt = null;
        void drain();
      },
      Math.min(RACEOS_QUEUE_SETTLE_MS, RACEOS_QUEUE_MAX_WAIT_MS - waited)
    );
    // Never hold the process open for a rating lookup.
    settleTimer.unref?.();
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
        // Moved rather than dropped, so a name is accounted for at every
        // moment: queued, in flight, or answered.
        for (const name of batch) {
          pending.delete(name);
          inflight.add(name);
        }
        try {
          await lookupBatch(batch, bearer);
        } finally {
          // Released either way. A failed batch caches nothing and is re-asked
          // by the next session poll, which is the intended recovery; holding
          // the names here across a failure would wedge the queue instead.
          for (const name of batch) inflight.delete(name);
        }
      }
    } catch (e) {
      logger.warn('[raceos] Rating lookup threw', e);
    } finally {
      draining = false;
    }
  };

  return {
    get(driverName) {
      return cache.get(raceosUsername(driverName))?.rating;
    },

    request(driverNames) {
      const names = driverNames
        .map(raceosUsername)
        .filter((name) => name.length > 0);
      // Held off until the backoff expires, and nothing to ask about with no
      // named drivers. Both are steady states of a session rather than
      // events, which is why neither is reported.
      if (now() < notBefore) return;
      if (names.length === 0) return;
      let queued = 0;
      for (const name of names) {
        if (pending.has(name) || inflight.has(name)) continue;
        // A remembered miss counts as known: not re-asking is the point.
        if (cache.get(name) !== undefined) continue;
        pending.add(name);
        queued += 1;
      }
      // A drain that stopped short -- no ticket yet, or inside a backoff --
      // leaves its names pending, and they are skipped above as already
      // queued. Nothing new would then ever start another drain, and on a
      // grid that does not change the ranks would never load.
      const stalled =
        pending.size > 0 && !draining && settleTimer === undefined;
      if (queued > 0 || stalled) scheduleDrain();
    },

    reset() {
      token = undefined;
      tokenExpiry = 0;
      pending.clear();
      inflight.clear();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = undefined;
      burstStartedAt = null;
      notBefore = 0;
      backoff = RACEOS_BACKOFF_MS;
    },
  };
}
