import { ReferenceLap } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';
import { readData } from './storage';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';
import { reportStorageResult, storageErrorCode } from './storageStatus';

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'referenceLaps.json');

// At most 500 series/track/class combinations, evicting oldest saved entries.
const MAX_REFERENCE_LAPS = 500;
const VERSION = '1.0.0';

/**
 * In-memory cache of all reference laps, lazy-loaded from disk on first
 * access. Eliminates the per-call read+parse+revive cost that previously
 * scanned the entire reference-lap database on every fetch and save.
 */
let cache: Map<string, ReferenceLap> | null = null;

/** Startup migration: only replace old data after a complete successful write. */
export const validateReferenceLapFile = () => {
  if (readData<string>('version', filePath) !== VERSION) {
    cache = new Map();
    writer.schedule();
  } else {
    loadCache();
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
 *
 * `speedsKph` is no longer written (see ReferenceLapProcessor.promote), but it
 * stays listed here so files already carrying it load as a Float32Array rather
 * than a plain number[] wearing that type.
 */
const reviver = (key: string, value: unknown): unknown => {
  if (
    (key === 'pointPos' ||
      key === 'times' ||
      key === 'tangents' ||
      key === 'speedsKph') &&
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
    cache = new Map(
      Object.entries(parsed)
        .filter(([key]) => key !== 'version')
        .slice(-MAX_REFERENCE_LAPS)
    );
  } catch (error) {
    logger.warn('Failed to read referenceLaps.json:', storageErrorCode(error));
    cache = new Map();
  }
  return cache;
};

const createWriter = () =>
  createDebouncedAtomicWriter({
    filePath,
    serialize: () =>
      JSON.stringify(
        { ...Object.fromEntries(loadCache()), version: VERSION },
        replacer,
        2
      ),
    onSuccess: () => {
      reportStorageResult('referenceLaps');
      logger.info(
        `[Main] Reference laps written to disk (${cache?.size ?? 0} entries)`
      );
    },
    onError: (error) => {
      logger.error(
        'Failed to write reference lap data:',
        storageErrorCode(error)
      );
      reportStorageResult('referenceLaps', error);
    },
  });
let writer = createWriter();

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
  cache = new Map(
    Object.entries(data)
      .filter(([key]) => key !== 'version')
      .slice(-MAX_REFERENCE_LAPS)
  );
  writer.schedule();
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
  const laps = loadCache();
  laps.delete(key);
  laps.set(key, lapData);
  const oldest = laps.keys().next().value;
  if (laps.size > MAX_REFERENCE_LAPS && oldest !== undefined)
    laps.delete(oldest);
  writer.schedule();
};

/**
 * Flush any pending write asynchronously. The before-quit coordinator awaits
 * this promise, so the last save is retained without blocking its deadline.
 */
export const flushReferenceLapsOnShutdown = () => writer.flush();

/**
 * Testing helper: await any in-flight write. Not exported in production
 * use — only consumed by the spec to deterministically observe the
 * debounced write completing.
 */
export const __awaitPendingWrite = async (): Promise<void> => {
  await writer.flush();
};

/**
 * Testing helper: reset module-level state so each spec starts clean.
 */
export const __resetForTests = (): void => {
  writer.cancel();
  cache = null;
  writer = createWriter();
};
