import { ReferenceLap } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import { readData, writeData } from './storage';

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'referenceLaps.json');

/**
 * Debounce window for async writes. Multiple saveReferenceLap() calls inside
 * this window collapse into a single write — addresses the 3×-per-fast-lap
 * write storm identified in the PCC race performance log (51 save log lines
 * for 17 distinct save events, one save per renderer).
 */
const WRITE_DEBOUNCE_MS = 250;

/**
 * In-memory cache of all reference laps, lazy-loaded from disk on first
 * access. Eliminates the per-call read+parse+revive cost that previously
 * scanned the entire reference-lap database on every fetch and save.
 */
let cache: Map<string, ReferenceLap> | null = null;

/**
 * Pending async write state. When a save is in flight or scheduled, additional
 * saves update the cache (and reset the debounce timer) without scheduling a
 * second write. On app shutdown, a sync flush picks up anything still pending.
 */
let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> | null = null;

/**
 * One-time migration to clear old reference lap data.
 * This should be removed in a future version.
 */
export const migrateReferenceLaps = () => {
  const MIGRATION_KEY = 'referenceLapsCleared_2026_5';
  const isMigrated = readData<boolean>(MIGRATION_KEY);

  if (!isMigrated) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info('One-time cleanup of referenceLaps.json performed');
      } catch (error) {
        logger.error(
          'Failed to delete referenceLaps.json during migration:',
          error
        );
      }
    }
    try {
      writeData(MIGRATION_KEY, true);
    } catch (error) {
      logger.error('Failed to persist migration flag:', error);
    }
  }
};

/**
 * Generates a unique composite key for storage.
 */
const generateKey = (
  seriesId: number,
  trackId: number,
  classId: number
): string => {
  return `${seriesId}_${trackId}_${classId}`;
};

/**
 * JSON Reviver: Converts arrays back to Float32Arrays for specific keys
 */
const reviver = (key: string, value: unknown): unknown => {
  if (
    (key === 'pointPos' || key === 'times' || key === 'tangents') &&
    Array.isArray(value)
  ) {
    return new Float32Array(value);
  }
  return value;
};

/**
 * JSON Replacer: Converts Float32Arrays to standard arrays for storage
 */
const replacer = (key: string, value: unknown): unknown => {
  if (value instanceof Float32Array) {
    return Array.from(value);
  }
  return value;
};

/**
 * Lazy-load the file into the in-memory cache on first access. Synchronous
 * by design — this runs once at startup, which is permitted by R6.1.
 */
const loadCache = (): Map<string, ReferenceLap> => {
  if (cache) return cache;
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data, reviver) as Record<string, ReferenceLap>;
    cache = new Map(Object.entries(parsed));
  } catch {
    cache = new Map();
  }
  return cache;
};

const flushAsync = async (): Promise<void> => {
  if (!cache) return;
  try {
    const obj = Object.fromEntries(cache);
    const jsonString = JSON.stringify(obj, replacer, 2);
    const entryCount = cache.size;
    await fsp.writeFile(filePath, jsonString);
    logger.info(
      `[Main] Reference laps written to disk (${entryCount} entries)`
    );
  } catch (error) {
    logger.error('Failed to write reference lap data:', error);
  }
};

/**
 * Synchronous flush for app shutdown — ensures any pending debounced write
 * makes it to disk before the process exits.
 */
const flushSync = (): void => {
  if (!cache) return;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    const obj = Object.fromEntries(cache);
    const jsonString = JSON.stringify(obj, replacer, 2);
    fs.writeFileSync(filePath, jsonString);
  } catch (error) {
    logger.error('Failed to flush reference lap data on shutdown:', error);
  }
};

/**
 * Schedule a debounced async write. Multiple calls within WRITE_DEBOUNCE_MS
 * collapse into a single write.
 */
const scheduleWrite = (): void => {
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writeInFlight = flushAsync().finally(() => {
      writeInFlight = null;
    });
  }, WRITE_DEBOUNCE_MS);
};

/**
 * Read all reference lap data from cache (lazy-loaded on first call).
 * Returns a fresh plain-object copy to preserve the previous external
 * contract for any caller that expects a mutable Record.
 */
export const readReferenceLaps = (): Record<string, ReferenceLap> => {
  return Object.fromEntries(loadCache());
};

/**
 * Replace the on-disk reference lap data. Updates the cache atomically and
 * schedules a debounced async write.
 */
export const writeReferenceLaps = (data: Record<string, ReferenceLap>) => {
  cache = new Map(Object.entries(data));
  scheduleWrite();
};

/**
 * Get reference lap for a specific combination. O(1) cache lookup.
 */
export const getReferenceLap = (
  seriesId: number,
  trackId: number,
  classId: number
): ReferenceLap | null => {
  const key = generateKey(seriesId, trackId, classId);
  return loadCache().get(key) ?? null;
};

/**
 * Save or update a reference lap for a specific combination. The cache is
 * updated synchronously so subsequent reads observe the new value; the disk
 * write is debounced so 3× per-renderer save bursts collapse to one write.
 */
export const saveReferenceLap = (
  seriesId: number,
  trackId: number,
  classId: number,
  lapData: ReferenceLap
) => {
  const key = generateKey(seriesId, trackId, classId);
  loadCache().set(key, lapData);
  scheduleWrite();
};

/**
 * Flush any pending write synchronously. Called on app shutdown to avoid
 * losing the last save if the user closes the app within WRITE_DEBOUNCE_MS
 * of setting a fast lap.
 */
export const flushReferenceLapsOnShutdown = (): void => {
  flushSync();
};

/**
 * Testing helper: await any in-flight write. Not exported in production
 * use — only consumed by the spec to deterministically observe the
 * debounced write completing.
 */
export const __awaitPendingWrite = async (): Promise<void> => {
  if (writeTimer) {
    await new Promise<void>((resolve) => {
      const t = writeTimer;
      writeTimer = setTimeout(() => {
        if (t) clearTimeout(t);
        writeTimer = null;
        writeInFlight = flushAsync().finally(() => {
          writeInFlight = null;
          resolve();
        });
      }, 0);
    });
  }
  if (writeInFlight) await writeInFlight;
};

/**
 * Testing helper: reset module-level state so each spec starts clean.
 */
export const __resetForTests = (): void => {
  cache = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  writeInFlight = null;
};
