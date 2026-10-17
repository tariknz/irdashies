import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { LmuDriverRating } from '@irdashies/types';
import logger from '../logger';

/**
 * Driver ratings already looked up, kept on disk between sessions.
 *
 * The point of persisting is the shape of a race weekend. Practice,
 * qualifying and the race are three separate sessions against the same twenty
 * or sixty drivers, and each one rebuilds the session from scratch -- so
 * without a cache the same grid is looked up three times in an hour. Holding
 * it in memory alone would not be enough either: the app is commonly closed
 * and reopened between sessions.
 *
 * Negative results are cached too, and that matters more than the positive
 * ones. Most AI entries and plenty of humans have no rating at all, and
 * without remembering the misses every single session would re-ask for every
 * one of them and get the same empty answer.
 *
 * Its own file rather than config.json, following knownLocalUserIds.ts:
 * config.json is written with a synchronous read-modify-write and an async
 * write to the same file could undo a setting saved in between.
 */
const FILE_NAME = 'lmu-driver-ratings.json';

/**
 * How long a rating is trusted. Ratings move after a race, so this is short
 * enough that a driver's standing is not stale for long, and long enough to
 * cover a whole race weekend in one lookup per driver.
 */
export const RATING_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * How long a miss is remembered. Much shorter than a hit: a driver who
 * registers mid-weekend should appear without waiting half a day, but a grid
 * full of AI should not be re-queried every session either.
 */
export const RATING_MISS_TTL_MS = 60 * 60 * 1000;

/**
 * Cap on stored entries, oldest evicted first. A busy public lobby turns over
 * a lot of Steam IDs and this file should not grow without bound.
 */
export const MAX_CACHED_RATINGS = 2000;

const WRITE_DEBOUNCE_MS = 1000;

interface CacheEntry {
  /** Absent for a remembered miss. */
  rating?: LmuDriverRating;
  /** Epoch ms this entry was written. */
  at: number;
}

interface PersistedRatings {
  version: 1;
  entries: Record<string, CacheEntry>;
}

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return app.getPath('userData');
}

const isEntry = (value: unknown): value is CacheEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CacheEntry>;
  if (typeof entry.at !== 'number' || !Number.isFinite(entry.at)) return false;
  return entry.rating === undefined || typeof entry.rating === 'object';
};

const sanitize = (value: unknown): Record<string, CacheEntry> => {
  if (!value || typeof value !== 'object') return {};
  const persisted = value as Partial<PersistedRatings>;
  if (persisted.version !== 1 || !persisted.entries) return {};
  if (typeof persisted.entries !== 'object') return {};
  const out: Record<string, CacheEntry> = {};
  for (const [key, entry] of Object.entries(persisted.entries)) {
    if (isEntry(entry)) out[key] = entry;
  }
  return out;
};

export interface DriverRatingCache {
  /**
   * A cached answer, or undefined when nothing usable is held.
   *
   * `{ rating: undefined }` is a *remembered miss* and is distinct from
   * undefined, which means "never asked, or expired". The caller must tell
   * them apart or the whole point of the negative cache is lost.
   */
  get(steamId: string): { rating?: LmuDriverRating } | undefined;
  /** Records a hit or, with no rating, a miss. Writes are debounced. */
  set(steamId: string, rating?: LmuDriverRating): void;
  /** Reads the file. Resolves even when it is missing or corrupt. */
  load(): Promise<void>;
  /** Writes any pending change now. */
  flush(): Promise<void>;
  /** Entries currently held, for logging. */
  size(): number;
}

export function createDriverRatingCache(
  storageDir?: string,
  now: () => number = Date.now
): DriverRatingCache {
  let entries: Record<string, CacheEntry> = {};
  let dirty = false;
  let timer: NodeJS.Timeout | undefined;
  let writing: Promise<void> = Promise.resolve();

  const filePath = () => path.join(storageDir ?? getStorageDir(), FILE_NAME);

  const fresh = (entry: CacheEntry): boolean => {
    const ttl = entry.rating ? RATING_TTL_MS : RATING_MISS_TTL_MS;
    return now() - entry.at < ttl;
  };

  /** Drops expired entries, then the oldest beyond the cap. */
  const prune = () => {
    const kept = Object.entries(entries).filter(([, entry]) => fresh(entry));
    kept.sort((a, b) => b[1].at - a[1].at);
    entries = Object.fromEntries(kept.slice(0, MAX_CACHED_RATINGS));
  };

  const write = async () => {
    dirty = false;
    prune();
    const payload: PersistedRatings = { version: 1, entries };
    // Serialised behind the previous write so two flushes cannot interleave
    // on the same file.
    writing = writing
      .catch(() => undefined)
      .then(async () => {
        try {
          await fsp.writeFile(filePath(), JSON.stringify(payload), 'utf8');
        } catch (e) {
          logger.warn('[raceos] Failed to persist driver ratings', e);
        }
      });
    await writing;
  };

  const schedule = () => {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void write();
    }, WRITE_DEBOUNCE_MS);
    // Never hold the process open for a cache write.
    timer.unref?.();
  };

  return {
    get(steamId) {
      const entry = entries[steamId];
      if (!entry) return undefined;
      if (!fresh(entry)) {
        // Rebuilt rather than deleted in place: the lint rule against
        // dynamic delete is there because it deoptimises the object shape,
        // and an expiring read is rare enough that a copy is cheaper overall.
        entries = Object.fromEntries(
          Object.entries(entries).filter(([key]) => key !== steamId)
        );
        return undefined;
      }
      return { rating: entry.rating };
    },

    set(steamId, rating) {
      entries[steamId] = { rating, at: now() };
      schedule();
    },

    async load() {
      try {
        const text = await fsp.readFile(filePath(), 'utf8');
        entries = sanitize(JSON.parse(text));
        prune();
        logger.info(
          `[raceos] Loaded ${Object.keys(entries).length} cached driver ratings`
        );
      } catch {
        // No file yet, or unreadable. Either way there is nothing to recover
        // and an empty cache is correct.
        entries = {};
      }
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (dirty) await write();
      else await writing;
    },

    size: () => Object.keys(entries).length,
  };
}
