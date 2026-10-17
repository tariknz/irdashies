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
 * another application rather than documented, so this spec is the only place
 * the sequence is ever exercised.
 */
const player = (steamId: string, rank = 'Gold') => ({
  platforms: [{ id: steamId, platform: 'steam' }],
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
            body: JSON.stringify({ accessToken: 'tok', expiresIn: 1800 }),
          }
        );
      }
      return (
        over.lookup ?? {
          ok: true,
          status: 200,
          body: JSON.stringify({ players }),
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
    const transport = transportFor([player('76561198000000111')]);
    const onResolved = vi.fn();
    const client = build(transport, undefined, onResolved);

    client.request(['76561198000000111']);
    await settle();

    // The order is the whole contract: no token, no lookup.
    expect(requests[0]?.url).toBe(RACEOS_AUTH_URL);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toEqual({ ticket: 'ticket' });
    expect(requests[1]?.url).toBe(
      `${RACEOS_PLAYERS_URL}?steamIds=76561198000000111`
    );
    expect(requests[1]?.token).toBe('tok');

    expect(client.get('76561198000000111')?.driverRank).toBe('Gold');
    expect(onResolved).toHaveBeenCalled();
  });

  it('remembers an id the service did not answer for', async () => {
    // The negative cache is the point: most AI and plenty of humans have no
    // rating, and without this every session re-asks for all of them.
    const client = build(transportFor([]));

    client.request(['76561198000000111']);
    await settle();

    expect(client.get('76561198000000111')).toBeUndefined();
    // Known-as-a-miss, so a second pass asks for nothing at all.
    const before = requests.length;
    client.request(['76561198000000111']);
    await settle();
    expect(requests).toHaveLength(before);
  });

  it('never calls out without a ticket', async () => {
    // A replay and a sim that is not signed in both land here, and neither is
    // a reason to touch the network.
    const transport = transportFor([]);
    const client = build(transport, async () => undefined);

    client.request(['76561198000000111']);
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

    client.request(['76561198000000111']);
    await settle();

    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain(
      'authentication failed'
    );

    // Inside the backoff nothing is attempted, so a service that is down is
    // not hammered once per session poll.
    const before = transport.mock.calls.length;
    client.request(['76561198000000222']);
    await settle();
    expect(transport.mock.calls).toHaveLength(before);

    // Past it, it tries again.
    now += RACEOS_BACKOFF_MS + 1;
    client.request(['76561198000000222']);
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

    client.request(['76561198000000111']);
    await settle();
    expect(requests.filter((r) => r.url === RACEOS_AUTH_URL)).toHaveLength(1);

    lookup = {
      ok: true,
      status: 200,
      body: JSON.stringify({ players: [player('76561198000000222')] }),
    };
    now += RACEOS_BACKOFF_MS + 1;
    client.request(['76561198000000222']);
    await settle();

    // A second exchange, rather than reusing the token that was refused.
    expect(
      requests.filter((r) => r.url === RACEOS_AUTH_URL).length
    ).toBeGreaterThan(1);
  });

  it('reuses a valid token across lookups', async () => {
    const client = build(transportFor([player('76561198000000111')]));

    client.request(['76561198000000111']);
    await settle();
    client.request(['76561198000000222']);
    await settle();

    expect(requests.filter((r) => r.url === RACEOS_AUTH_URL)).toHaveLength(1);
  });

  it('asks in batches rather than one id at a time', async () => {
    const ids = Array.from(
      { length: RACEOS_BATCH_SIZE + 10 },
      (_, i) => `7656119800000${String(i).padStart(4, '0')}`
    );
    const client = build(transportFor([]));

    client.request(ids);
    await settle();

    const lookups = requests.filter((r) => r.url !== RACEOS_AUTH_URL);
    expect(lookups).toHaveLength(2);
    expect(lookups[0]?.url.split('steamIds=')[1]?.split(',')).toHaveLength(
      RACEOS_BATCH_SIZE
    );
  });

  it('says what it decided about the grid', async () => {
    // The three states below all render as a bare standings row, so the log is
    // the only way to tell them apart.
    const client = build(transportFor([player('76561198000000111')]));

    client.request([]);
    client.request(['76561198000000111']);
    await settle();
    client.request(['76561198000000111']);

    const notes = vi
      .mocked(logger.info)
      .mock.calls.map(([m]) => String(m))
      .join('\n');
    expect(notes).toContain('No human Steam ids on the grid');
    expect(notes).toContain('Looking up 1 of 1');
    expect(notes).toContain('already known from cache');
  });

  it('does not repeat itself while the grid is unchanged', async () => {
    const client = build(transportFor([player('76561198000000111')]));

    client.request(['76561198000000111']);
    await settle();
    const before = vi.mocked(logger.info).mock.calls.length;
    client.request(['76561198000000111']);
    client.request(['76561198000000111']);
    client.request(['76561198000000111']);

    expect(vi.mocked(logger.info).mock.calls).toHaveLength(before + 1);
  });

  it('survives a lookup body that is not readable JSON', async () => {
    const client = build(
      transportFor([], {
        lookup: { ok: true, status: 200, body: 'not json' },
      })
    );

    client.request(['76561198000000111']);
    await settle();

    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain(
      'unreadable JSON'
    );
    expect(client.get('76561198000000111')).toBeUndefined();
  });

  it('forgets its token and queue on reset but keeps the cache', async () => {
    const client = build(transportFor([player('76561198000000111')]));

    client.request(['76561198000000111']);
    await settle();
    client.reset();

    // The rating survives: it lives in the cache, which outlives a session.
    expect(client.get('76561198000000111')?.driverRank).toBe('Gold');

    client.request(['76561198000000222']);
    await settle();
    expect(
      requests.filter((r) => r.url === RACEOS_AUTH_URL).length
    ).toBeGreaterThan(1);
  });
});
