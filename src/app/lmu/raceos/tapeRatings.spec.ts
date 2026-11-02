import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createLmuTapeRatingClient, REPLAY_RATINGS_PATH } from './tapeRatings';

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * The replay half of the rating feature.
 *
 * A tape cannot resolve ratings the live way -- the ticket that authorises the
 * lookup is deliberately never recorded -- so `anonymise` bakes them in, keyed
 * by driver name. This reads that record.
 *
 * The bodies here are the real shape: whatever buildRatingsBody in
 * lmu_replay_main.cpp writes, which is the app's own cached rating objects
 * keyed by the names the anonymised snapshots carry.
 */
describe('createLmuTapeRatingClient', () => {
  const body = JSON.stringify({
    'Herve Attard': { driverRank: 'Gold', countryCode: 'FR' },
    'Leonel Gomez': { safetyRank: 'Silver' },
  });

  type Reader = (path: string) => string | null;
  let readRest: Mock<Reader>;

  beforeEach(() => {
    vi.clearAllMocks();
    readRest = vi.fn<Reader>((path) =>
      path === REPLAY_RATINGS_PATH ? body : null
    );
  });

  it('serves a baked rating for a driver name', () => {
    const client = createLmuTapeRatingClient({ readRest });

    expect(client.get('Herve Attard')?.driverRank).toBe('Gold');
    expect(client.get('Leonel Gomez')?.safetyRank).toBe('Silver');
  });

  it('returns undefined for a name the tape has nothing for', () => {
    const client = createLmuTapeRatingClient({ readRest });

    expect(client.get('Nobody Here')).toBeUndefined();
  });

  it('matches a name whatever padding either side carries', () => {
    // The keys were rewritten by the anonymiser's text substitution, which has
    // no reason to preserve the trimming the lookup applied when they were
    // stored -- so both sides are canonicalised again here.
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() =>
        JSON.stringify({ '  Herve Attard  ': { driverRank: 'Gold' } })
      ),
    });

    expect(client.get('  Herve Attard ')?.driverRank).toBe('Gold');
  });

  it('keeps a #1234 discriminator in the key', () => {
    // The discriminator is part of the username, so a tape keyed by the full
    // form must be looked up by the full form.
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() =>
        JSON.stringify({ 'Sherry Dalton#6487': { driverRank: 'Silver' } })
      ),
    });

    expect(client.get('Sherry Dalton#6487')?.driverRank).toBe('Silver');
    expect(client.get('Sherry Dalton')).toBeUndefined();
  });

  it('reads the tape once rather than per driver', () => {
    // get() is called for every driver while a snapshot is built, at up to the
    // session poll rate. Parsing the body each time would put JSON.parse on
    // that path for no gain -- a tape's contents cannot change under it.
    const client = createLmuTapeRatingClient({ readRest });

    client.get('Herve Attard');
    client.get('Leonel Gomez');
    client.get('Herve Attard');

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

    expect(client.get('Herve Attard')).toBeUndefined();
    expect(client.get('Herve Attard')).toBeUndefined();

    expect(empty).toHaveBeenCalledTimes(2);
  });

  it('survives a body that is not readable JSON', () => {
    // The body came off a file written on someone else's machine. A tape that
    // cannot be parsed must leave the standings alone, not break them.
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() => '{not json'),
    });

    expect(client.get('Herve Attard')).toBeUndefined();
  });

  it('ignores entries that are not rating objects', () => {
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() =>
        JSON.stringify({ 'Herve Attard': 'nope', 'Other One': null })
      ),
    });

    expect(client.get('Herve Attard')).toBeUndefined();
    expect(client.get('Other One')).toBeUndefined();
  });

  it('drops fields a fresh record would not be allowed to carry', () => {
    // A tape from an older build, or one edited by hand. An unknown rank would
    // be drawn as an unstyled chip, so it goes the way the live parser sends it.
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() =>
        JSON.stringify({
          'Herve Attard': {
            driverRank: 'Diamond',
            driverTier: 3,
            safetyRank: 'Silver',
            safetyTier: '2',
            countryCode: 42,
          },
          'Leonel Gomez': { driverRank: 'Diamond', countryCode: 42 },
        })
      ),
    });

    expect(client.get('Herve Attard')).toEqual({ safetyRank: 'Silver' });
    // Nothing usable left at all: a miss, not an empty rating.
    expect(client.get('Leonel Gomez')).toBeUndefined();
  });

  it('survives a tape that throws on read', () => {
    const client = createLmuTapeRatingClient({
      readRest: vi.fn<Reader>(() => {
        throw new Error('tape is gone');
      }),
    });

    expect(() => client.get('Herve Attard')).not.toThrow();
    expect(client.get('Herve Attard')).toBeUndefined();
  });

  it('asks for nothing and forgets on reset', () => {
    // request() exists only to satisfy the interface the bridge holds: a tape
    // already contains everything it will ever know.
    const client = createLmuTapeRatingClient({ readRest });

    client.request(['Herve Attard']);
    expect(readRest).not.toHaveBeenCalled();

    client.get('Herve Attard');
    client.reset();
    client.get('Herve Attard');

    expect(readRest).toHaveBeenCalledTimes(2);
  });
});
