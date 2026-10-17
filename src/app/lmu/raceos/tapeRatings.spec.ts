import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createLmuTapeRatingClient, REPLAY_RATINGS_PATH } from './tapeRatings';

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * The replay half of the rating feature.
 *
 * A tape cannot resolve ratings the live way -- the ticket that authorises the
 * lookup is deliberately never recorded -- so `anonymise` bakes them in under
 * synthetic Steam ids instead. This reads that record.
 *
 * The bodies here are the real shape: whatever buildRatingsBody in
 * lmu_replay_main.cpp writes, which is the app's own cached rating objects
 * keyed by the ids the anonymised snapshots carry.
 */
describe('createLmuTapeRatingClient', () => {
  const body = JSON.stringify({
    '76561190000000001': { driverRank: 'Gold', countryCode: 'FR' },
    '76561190000000002': { safetyRank: 'Silver' },
  });

  type Reader = (path: string) => string | null;
  let readRest: Mock<Reader>;

  beforeEach(() => {
    vi.clearAllMocks();
    readRest = vi.fn<Reader>((path) =>
      path === REPLAY_RATINGS_PATH ? body : null
    );
  });

  it('serves a baked rating for a synthetic Steam id', () => {
    const client = createLmuTapeRatingClient({ readRest });

    expect(client.get('76561190000000001')?.driverRank).toBe('Gold');
    expect(client.get('76561190000000002')?.safetyRank).toBe('Silver');
  });

  it('returns undefined for an id the tape has nothing for', () => {
    const client = createLmuTapeRatingClient({ readRest });

    expect(client.get('76561190000000009')).toBeUndefined();
  });

  it('reads the tape once rather than per driver', () => {
    // get() is called for every driver while a snapshot is built, at up to the
    // session poll rate. Parsing the body each time would put JSON.parse on
    // that path for no gain -- a tape's contents cannot change under it.
    const client = createLmuTapeRatingClient({ readRest });

    client.get('76561190000000001');
    client.get('76561190000000002');
    client.get('76561190000000001');

    expect(readRest).toHaveBeenCalledTimes(1);
  });

  it('keeps asking while the tape has no record yet', () => {
    // REST records are interleaved with snapshots. The ratings record is
    // written first, so in practice it is there from the start -- but a tape
    // recorded before this existed, or anonymised with --no-ratings, has none
    // at all, and memoising the absence would be indistinguishable from
    // memoising a body that simply had not arrived.
    const empty = vi.fn<Reader>(() => null);
    const client = createLmuTapeRatingClient({ readRest: empty });

    expect(client.get('76561190000000001')).toBeUndefined();
    expect(client.get('76561190000000001')).toBeUndefined();

    expect(empty).toHaveBeenCalledTimes(2);
  });

  it('survives a body that is not readable JSON', () => {
    // The body came off a file written on someone else's machine. A tape that
    // cannot be parsed must leave the standings alone, not break them.
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() => '{not json'),
    });

    expect(client.get('76561190000000001')).toBeUndefined();
  });

  it('ignores entries that are not rating objects', () => {
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() =>
        JSON.stringify({ '76561190000000001': 'nope', '2': null })
      ),
    });

    expect(client.get('76561190000000001')).toBeUndefined();
    expect(client.get('2')).toBeUndefined();
  });

  it('survives a tape that throws on read', () => {
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() => {
        throw new Error('tape is gone');
      }),
    });

    expect(() => client.get('76561190000000001')).not.toThrow();
    expect(client.get('76561190000000001')).toBeUndefined();
  });

  it('asks for nothing and forgets on reset', () => {
    // request() exists only to satisfy the interface the bridge holds: a tape
    // already contains everything it will ever know.
    const client = createLmuTapeRatingClient({ readRest });

    client.request(['76561190000000001']);
    expect(readRest).not.toHaveBeenCalled();

    client.get('76561190000000001');
    client.reset();
    client.get('76561190000000001');

    expect(readRest).toHaveBeenCalledTimes(2);
  });
});
