import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRaceosClient,
  RACEOS_AUTH_URL,
  RACEOS_BACKOFF_MS,
  RACEOS_BATCH_SIZE,
  RACEOS_PLAYERS_URL,
} from './client';
import logger from '../../logger';
import type { DriverRatingCache } from '../../storage/driverRatings';
import type { LmuDriverRating } from '@irdashies/types';
import type { RaceosRequest, RaceosResponse } from './httpsJson';

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * The whole rating flow, with no network, no sim and no clock.
 *
 * Every piece of IO is injected precisely so this is possible, and it matters
 * more here than usual: the endpoints and payload shapes were recovered from
 * another application and then checked against the live service, so this spec
 * is the only place the sequence is exercised in CI.
 *
 * The shapes asserted below are the observed ones. Getting any of them wrong
 * produces no error anywhere -- just a grid with no badges -- which is exactly
 * what happened while the request was a guess.
 */
const player = (username: string, rank = 'Gold') => ({
  username,
  name: username,
  driverRank: { rank, tier: 3 },
  profile: { nationality: 'FRA' },
});

/** A cache that behaves like the real one without touching disk. */
const fakeCache = (): DriverRatingCache => {
  const entries = new Map<string, { rating?: LmuDriverRating }>();
  return {
    get: (steamId) => entries.get(steamId),
    set: (steamId, rating) => entries.set(steamId, { rating }),
    load: async () => undefined,
    flush: async () => undefined,
    size: () => entries.size,
  };
};

describe('createRaceosClient', () => {
  let requests: RaceosRequest[];
  let cache: DriverRatingCache;
  let now: number;

  beforeEach(() => {
    vi.clearAllMocks();
    requests = [];
    cache = fakeCache();
    now = 1_000_000;
  });

  /** A transport that authenticates, then answers with the given players. */
  const transportFor = (
    players: unknown,
    over: { auth?: RaceosResponse; lookup?: RaceosResponse } = {}
  ) =>
    vi.fn(async (request: RaceosRequest): Promise<RaceosResponse> => {
      requests.push(request);
      if (request.url === RACEOS_AUTH_URL) {
        return (
          over.auth ?? {
            ok: true,
            status: 200,
            body: JSON.stringify({
              accessToken: 'tok',
              expiresAt: new Date(now + 1_800_000).toISOString(),
            }),
          }
        );
      }
      return (
        over.lookup ?? {
          ok: true,
          status: 200,
          body: JSON.stringify(players),
        }
      );
    });

  const build = (
    transport: ReturnType<typeof transportFor>,
    fetchTicket: () => Promise<string | undefined> = async () => 'ticket',
    onResolved?: () => void
  ) =>
    createRaceosClient({
      transport,
      cache,
      fetchTicket,
      onResolved,
      now: () => now,
    });

  /** Lets the client's queued drain run to completion. */
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it('exchanges a ticket then looks the grid up', async () => {
    const transport = transportFor([player('Herve Attard')]);
    const onResolved = vi.fn();
    const client = build(transport, undefined, onResolved);

    client.request(['Herve Attard']);
    await settle();

    // The order is the whole contract: no token, no lookup.
    expect(requests[0]?.url).toBe(RACEOS_AUTH_URL);
    expect(requests[0]?.method).toBe('POST');
    // game and platform are both required: without them the service answers
    // "Invalid game specified", and the ticket's key is `token`, not `ticket`.
    expect(requests[0]?.body).toEqual({
      token: 'ticket',
      game: 'lmu',
      platform: 'steam',
    });

    // A POST with the names in the body -- not a query string, and not keyed
    // by Steam id, which the sim reports as 0 for everyone.
    expect(requests[1]?.url).toBe(RACEOS_PLAYERS_URL);
    expect(requests[1]?.method).toBe('POST');
    expect(requests[1]?.body).toEqual({ usernames: ['Herve Attard'] });
    expect(requests[1]?.token).toBe('tok');

    expect(client.get('Herve Attard')?.driverRank).toBe('Gold');
    expect(onResolved).toHaveBeenCalled();
  });

  it('remembers a name the service did not answer for', async () => {
    // The negative cache is the point: most AI and plenty of humans have no
    // rating, and without this every session re-asks for all of them.
    const client = build(transportFor([]));

    client.request(['Herve Attard']);
    await settle();

    expect(client.get('Herve Attard')).toBeUndefined();
    // Known-as-a-miss, so a second pass asks for nothing at all.
    const before = requests.length;
    client.request(['Herve Attard']);
    await settle();
    expect(requests).toHaveLength(before);
  });

  it('never calls out without a ticket', async () => {
    // A replay and a sim that is not signed in both land here, and neither is
    // a reason to touch the network.
    const transport = transportFor([]);
    const client = build(transport, async () => undefined);

    client.request(['Herve Attard']);
    await settle();

    expect(transport).not.toHaveBeenCalled();
    expect(
      vi
        .mocked(logger.info)
        .mock.calls.map(([m]) => String(m))
        .join(' ')
    ).toContain('No Steam auth ticket');
  });

  it('backs off when authentication fails', async () => {
    const transport = transportFor([], {
      auth: { ok: false, status: 500, reason: 'status' },
    });
    const client = build(transport);

    client.request(['Herve Attard']);
    await settle();

    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain(
      'authentication failed'
    );

    // Inside the backoff nothing is attempted, so a service that is down is
    // not hammered once per session poll.
    const before = transport.mock.calls.length;
    client.request(['Leonel Gomez']);
    await settle();
    expect(transport.mock.calls).toHaveLength(before);

    // Past it, it tries again.
    now += RACEOS_BACKOFF_MS + 1;
    client.request(['Leonel Gomez']);
    await settle();
    expect(transport.mock.calls.length).toBeGreaterThan(before);
  });

  it('drops the token when the service rejects it', async () => {
    // Otherwise a stale token is presented forever and every lookup 401s.
    let lookup: RaceosResponse = { ok: false, status: 401, reason: 'status' };
    const transport = vi.fn(async (request: RaceosRequest) => {
      requests.push(request);
      if (request.url === RACEOS_AUTH_URL) {
        return {
          ok: true,
          status: 200,
          body: JSON.stringify({ accessToken: 'tok' }),
        } as RaceosResponse;
      }
      return lookup;
    });
    const client = build(transport as ReturnType<typeof transportFor>);

    client.request(['Herve Attard']);
    await settle();
    expect(requests.filter((r) => r.url === RACEOS_AUTH_URL)).toHaveLength(1);

    lookup = {
      ok: true,
      status: 200,
      body: JSON.stringify({ players: [player('Leonel Gomez')] }),
    };
    now += RACEOS_BACKOFF_MS + 1;
    client.request(['Leonel Gomez']);
    await settle();

    // A second exchange, rather than reusing the token that was refused.
    expect(
      requests.filter((r) => r.url === RACEOS_AUTH_URL).length
    ).toBeGreaterThan(1);
  });

  it('reuses a valid token across lookups', async () => {
    const client = build(transportFor([player('Herve Attard')]));

    client.request(['Herve Attard']);
    await settle();
    client.request(['Leonel Gomez']);
    await settle();

    expect(requests.filter((r) => r.url === RACEOS_AUTH_URL)).toHaveLength(1);
  });

  it('asks in batches rather than one name at a time', async () => {
    const names = Array.from(
      { length: RACEOS_BATCH_SIZE + 10 },
      (_, i) => `Driver ${i}`
    );
    const client = build(transportFor([]));

    client.request(names);
    await settle();

    const lookups = requests.filter((r) => r.url !== RACEOS_AUTH_URL);
    expect(lookups).toHaveLength(2);
    expect(
      (lookups[0]?.body as { usernames: string[] }).usernames
    ).toHaveLength(RACEOS_BATCH_SIZE);
  });

  it('honours the absolute expiry the service returns', async () => {
    // `expiresAt` is an instant, not a duration. Read as a count of seconds it
    // would be a nonsensical TTL and the token re-exchanged on every batch.
    const client = build(transportFor([player('Herve Attard')]));
    const exchanges = () =>
      requests.filter((r) => r.url === RACEOS_AUTH_URL).length;

    client.request(['Herve Attard']);
    await settle();
    expect(exchanges()).toBe(1);

    // Well inside the stated 30 minutes: the token still stands.
    now += 10 * 60_000;
    client.request(['Leonel Gomez']);
    await settle();
    expect(exchanges()).toBe(1);

    // Past it: exchanged again.
    now += 30 * 60_000;
    client.request(['Someone Else']);
    await settle();
    expect(exchanges()).toBe(2);
  });

  it('canonicalises the names it sends', async () => {
    // Sent as the standings spell them, minus any '#' suffix and padding.
    const client = build(transportFor([]));

    client.request(['  Herve Attard#1234 ', 'Leonel Gomez']);
    await settle();

    const lookup = requests.find((r) => r.url === RACEOS_PLAYERS_URL);
    expect(lookup?.body).toEqual({
      usernames: ['Herve Attard', 'Leonel Gomez'],
    });
  });

  it('matches an answer whose spelling differs from the request', async () => {
    // The service answers with its own stored spelling, which need not be the
    // one asked for. Keyed on its spelling, every rating would be filed under
    // a name no driver presents -- and nothing would say so, because the
    // service did answer.
    const client = build(transportFor([player('HERVE ATTARD')]));

    client.request(['Herve Attard']);
    await settle();

    expect(client.get('Herve Attard')?.driverRank).toBe('Gold');
  });

  it('counts what matched, not what came back', async () => {
    // The old line reported the service's answer count, so a join that failed
    // for every name on the grid still read as a complete success.
    const client = build(transportFor([player('Someone Else')]));

    client.request(['Herve Attard']);
    await settle();

    const notes = vi
      .mocked(logger.info)
      .mock.calls.map(([m]) => String(m))
      .join('\n');
    expect(notes).toContain('Matched 0/1 driver ratings');
    expect(notes).toContain('service answered for 1');
  });

  it('warns when answers came back that match nobody', async () => {
    // Answers for names nobody on the grid has can only be a bug, so both
    // spellings go in the log: the difference between them is the diagnosis.
    const client = build(transportFor([player('Someone Else')]));

    client.request(['Herve Attard']);
    await settle();

    const warning = vi
      .mocked(logger.warn)
      .mock.calls.map(([m]) => String(m))
      .join('\n');
    expect(warning).toContain('none');
    expect(warning).toContain('"Herve Attard"');
    expect(warning).toContain('"Someone Else"');
  });

  it('does not republish when nothing matched', async () => {
    // A rebuild would produce the same standings, twice a second, for as long
    // as the grid held.
    const onResolved = vi.fn();
    const client = build(
      transportFor([player('Someone Else')]),
      undefined,
      onResolved
    );

    client.request(['Herve Attard']);
    await settle();

    expect(onResolved).not.toHaveBeenCalled();
  });

  it('says what it decided about the grid', async () => {
    // The three states below all render as a bare standings row, so the log is
    // the only way to tell them apart.
    const client = build(transportFor([player('Herve Attard')]));

    client.request([]);
    client.request(['Herve Attard']);
    await settle();
    client.request(['Herve Attard']);

    const notes = vi
      .mocked(logger.info)
      .mock.calls.map(([m]) => String(m))
      .join('\n');
    expect(notes).toContain('No named drivers on the grid');
    expect(notes).toContain('Looking up 1 of 1');
    expect(notes).toContain('already known from cache');
  });

  it('does not repeat itself while the grid is unchanged', async () => {
    const client = build(transportFor([player('Herve Attard')]));

    client.request(['Herve Attard']);
    await settle();
    const before = vi.mocked(logger.info).mock.calls.length;
    client.request(['Herve Attard']);
    client.request(['Herve Attard']);
    client.request(['Herve Attard']);

    expect(vi.mocked(logger.info).mock.calls).toHaveLength(before + 1);
  });

  it('survives a lookup body that is not readable JSON', async () => {
    const client = build(
      transportFor([], {
        lookup: { ok: true, status: 200, body: 'not json' },
      })
    );

    client.request(['Herve Attard']);
    await settle();

    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain(
      'unreadable JSON'
    );
    expect(client.get('Herve Attard')).toBeUndefined();
  });

  it('forgets its token and queue on reset but keeps the cache', async () => {
    const client = build(transportFor([player('Herve Attard')]));

    client.request(['Herve Attard']);
    await settle();
    client.reset();

    // The rating survives: it lives in the cache, which outlives a session.
    expect(client.get('Herve Attard')?.driverRank).toBe('Gold');

    client.request(['Leonel Gomez']);
    await settle();
    expect(
      requests.filter((r) => r.url === RACEOS_AUTH_URL).length
    ).toBeGreaterThan(1);
  });
});
