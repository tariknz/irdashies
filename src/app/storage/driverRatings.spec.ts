import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  createDriverRatingCache,
  MAX_CACHED_RATINGS,
  RATING_MISS_TTL_MS,
  RATING_TTL_MS,
} from './driverRatings';

let dir: string;
let clock = 1_000_000;
const now = () => clock;

beforeEach(async () => {
  clock = 1_000_000;
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'irdashies-ratings-'));
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

const gold = { driverRank: 'Gold' as const, driverTier: 2 };

describe('driver rating cache', () => {
  it('returns a stored rating', () => {
    const cache = createDriverRatingCache(dir, now);
    cache.set('76561198000000001', gold);
    expect(cache.get('76561198000000001')?.rating).toEqual(gold);
  });

  it('distinguishes a remembered miss from never having asked', () => {
    // The whole point of the negative cache: a grid of AI must not be
    // re-queried every session, so "asked, got nothing" has to be a hit.
    const cache = createDriverRatingCache(dir, now);
    cache.set('ai-1', undefined);

    const remembered = cache.get('ai-1');
    expect(remembered).toBeDefined();
    expect(remembered?.rating).toBeUndefined();

    expect(cache.get('never-asked')).toBeUndefined();
  });

  it('expires a rating after its TTL', () => {
    const cache = createDriverRatingCache(dir, now);
    cache.set('a', gold);
    clock += RATING_TTL_MS - 1;
    expect(cache.get('a')).toBeDefined();
    clock += 2;
    expect(cache.get('a')).toBeUndefined();
  });

  it('expires a miss sooner than a hit', () => {
    // A driver who registers mid-weekend should appear without waiting out
    // the full rating TTL.
    const cache = createDriverRatingCache(dir, now);
    cache.set('hit', gold);
    cache.set('miss', undefined);
    clock += RATING_MISS_TTL_MS + 1;
    expect(cache.get('hit')).toBeDefined();
    expect(cache.get('miss')).toBeUndefined();
  });

  it('survives a reload, which is what makes it useful between sessions', async () => {
    // Practice, qualifying and the race are three separate sessions against
    // the same grid, often with the app closed in between.
    const first = createDriverRatingCache(dir, now);
    first.set('76561198000000002', gold);
    first.set('ai-7', undefined);
    await first.flush();

    const second = createDriverRatingCache(dir, now);
    await second.load();
    expect(second.get('76561198000000002')?.rating).toEqual(gold);
    expect(second.get('ai-7')).toBeDefined();
    expect(second.get('ai-7')?.rating).toBeUndefined();
  });

  it('drops entries that expired while the app was closed', async () => {
    const first = createDriverRatingCache(dir, now);
    first.set('stale', gold);
    await first.flush();

    clock += RATING_TTL_MS + 1;
    const second = createDriverRatingCache(dir, now);
    await second.load();
    expect(second.get('stale')).toBeUndefined();
  });

  it('loads an empty cache when there is no file', async () => {
    const cache = createDriverRatingCache(
      path.join(dir, 'does-not-exist'),
      now
    );
    await cache.load();
    expect(cache.size()).toBe(0);
  });

  it('loads an empty cache from a corrupt file rather than throwing', async () => {
    await fsp.writeFile(
      path.join(dir, 'lmu-driver-ratings.json'),
      '{ not json',
      'utf8'
    );
    const cache = createDriverRatingCache(dir, now);
    await cache.load();
    expect(cache.size()).toBe(0);
  });

  it('ignores a file written by a future schema', async () => {
    await fsp.writeFile(
      path.join(dir, 'lmu-driver-ratings.json'),
      JSON.stringify({ version: 3, entries: { a: { rating: gold, at: 1 } } }),
      'utf8'
    );
    const cache = createDriverRatingCache(dir, now);
    await cache.load();
    expect(cache.size()).toBe(0);
  });

  it('discards a file keyed by Steam id', async () => {
    // Version 1 was keyed by Steam id, which the sim reports as 0 for every
    // driver -- so such a file holds nothing that could ever match a lookup
    // again. Dropped rather than migrated: there is no name to migrate it to.
    await fsp.writeFile(
      path.join(dir, 'lmu-driver-ratings.json'),
      JSON.stringify({
        version: 1,
        entries: { '76561198000000111': { rating: gold, at: 1 } },
      }),
      'utf8'
    );
    const cache = createDriverRatingCache(dir, now);
    await cache.load();
    expect(cache.size()).toBe(0);
  });

  it('caps the stored entries, keeping the newest', async () => {
    const cache = createDriverRatingCache(dir, now);
    for (let i = 0; i < MAX_CACHED_RATINGS + 50; i++) {
      clock += 1;
      cache.set(`driver-${i}`, gold);
    }
    await cache.flush();

    const reloaded = createDriverRatingCache(dir, now);
    await reloaded.load();
    expect(reloaded.size()).toBe(MAX_CACHED_RATINGS);
    expect(reloaded.get('driver-0')).toBeUndefined();
    expect(reloaded.get(`driver-${MAX_CACHED_RATINGS + 49}`)?.rating).toEqual(
      gold
    );
  });
});
