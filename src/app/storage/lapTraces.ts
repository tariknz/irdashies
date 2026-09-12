import {
  LAP_TRACE_SCHEMA_VERSION,
  type LapTraceRecord,
  type LapTraceSource,
} from '@irdashies/types';
import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'lapTraces.json');

/** Debounce window for async writes — collapses a burst of saves into one. */
const WRITE_DEBOUNCE_MS = 250;

/**
 * Cap on stored laps (R6.3). A lap is stored at telemetry rate — roughly
 * 300 KB of JSON for a 100 s lap, ~1.5 MB for a Nordschleife lap — so 40 keys
 * is ~12 MB worst case, read and parsed once on first access. When the cap is
 * hit the oldest `recordedAt` is pruned.
 */
const MAX_LAP_TRACE_KEYS = 40;

/**
 * Decimal places kept per sample array when serialising. Float32 -> JSON
 * otherwise writes 0.34 as 0.3400000035762787, roughly tripling the file for
 * noise that is far below the resolution of anything we render.
 *
 * Also the reviver's allowlist: only arrays under these names come back as
 * Float32Array, so a new sample field must be registered here or it loads as
 * a plain array.
 */
const SAMPLE_PRECISION: Record<string, number> = {
  // 1 cm along the lap. Pedal application points are interpolated from these,
  // so this is what bounds "where exactly did the reference brake".
  distanceM: 2,
  // Corner deltas are shown to 10 ms and come from subtracting two of these;
  // 0.1 ms keeps the quantisation noise an order of magnitude below that.
  timeSec: 4,
  throttle: 3,
  brake: 3,
  speed: 2,
  gear: 0,
  absActive: 0,
};

/**
 * In-memory cache of all lap traces, keyed by "trackId:carPath:kind". The
 * source kind is part of the key so a recorded best, an imported .ibt lap and
 * a fetched lap can coexist and the user can switch between them in settings
 * without re-recording.
 */
let cache: Map<string, LapTraceRecord> | null = null;

/**
 * The in-flight first read, shared by every caller that arrives while it is
 * running so the file is read once and parsed once.
 */
let loading: Promise<Map<string, LapTraceRecord>> | null = null;

let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> | null = null;

const generateKey = (
  trackId: number,
  carPath: string,
  kind: LapTraceSource
): string => `${trackId}:${carPath}:${kind}`;

const quantise = (arr: Float32Array, decimals: number): number[] => {
  const factor = 10 ** decimals;
  const out = new Array<number>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = Math.round(arr[i] * factor) / factor;
  }
  return out;
};

/** JSON replacer: Float32Array sample arrays -> quantised number arrays. */
const replacer = (key: string, value: unknown): unknown => {
  if (value instanceof Float32Array) {
    return quantise(value, SAMPLE_PRECISION[key] ?? 3);
  }
  return value;
};

/** JSON reviver: sample arrays -> Float32Array. */
const reviver = (key: string, value: unknown): unknown => {
  if (key in SAMPLE_PRECISION && Array.isArray(value)) {
    return new Float32Array(value as number[]);
  }
  return value;
};

/**
 * Read and parse the file. Records from another schema version are dropped
 * here rather than migrated: the format has only ever shipped on a feature
 * branch, and every reader downstream assumes the current shape.
 */
const readCacheFromDisk = async (): Promise<Map<string, LapTraceRecord>> => {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data, reviver) as Record<string, LapTraceRecord>;
    const entries = Object.entries(parsed);
    const current = entries.filter(
      ([, record]) => record?.schemaVersion === LAP_TRACE_SCHEMA_VERSION
    );
    if (current.length !== entries.length) {
      logger.info(
        `[Main] Discarded ${entries.length - current.length} lap trace(s) from an older schema`
      );
    }
    return new Map(current);
  } catch {
    return new Map();
  }
};

/**
 * Lazy-load the file into the in-memory cache on first access.
 *
 * Asynchronous because first access is not necessarily startup: the lap-trace
 * IPC handlers reach this the moment the driver enables the widget or opens
 * Settings, which can be mid-session. A synchronous read of up to ~12 MB
 * there would block the main process — and with it telemetry polling — for as
 * long as the parse takes. Every caller in a burst shares one read.
 */
const loadCache = async (): Promise<Map<string, LapTraceRecord>> => {
  if (cache) return cache;
  loading ??= readCacheFromDisk().then((loaded) => {
    cache ??= loaded;
    loading = null;
    return cache;
  });
  return loading;
};

const flushAsync = async (): Promise<void> => {
  if (!cache) return;
  try {
    const obj = Object.fromEntries(cache);
    const entryCount = cache.size;
    await fsp.writeFile(filePath, JSON.stringify(obj, replacer));
    logger.info(`[Main] Lap traces written to disk (${entryCount} entries)`);
  } catch (error) {
    logger.error('[Main] Failed to write lap trace data:', error);
  }
};

/**
 * Drain the debounced and in-flight writes without blocking the event loop.
 *
 * The queue is what makes this safe: a write that bypassed it could run
 * alongside one already in progress, and whichever finished last would decide
 * the file's contents — so the final cache could lose to an older write.
 * Cancelling the debounce and queueing behind the current write means the
 * last write to run is the one that serialises the latest cache.
 */
const flushPendingWrites = async (): Promise<void> => {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    enqueueFlush();
  }
  while (writeInFlight) {
    await writeInFlight;
  }
};

const enqueueFlush = (): void => {
  const previous = writeInFlight ?? Promise.resolve();
  const tracked = previous
    .catch(() => undefined)
    .then(() => flushAsync())
    .finally(() => {
      if (writeInFlight === tracked) {
        writeInFlight = null;
      }
    });
  writeInFlight = tracked;
};

const scheduleWrite = (): void => {
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    enqueueFlush();
  }, WRITE_DEBOUNCE_MS);
};

/** Drop the oldest entries until the cache is within the cap. */
const pruneToCap = (map: Map<string, LapTraceRecord>): void => {
  while (map.size > MAX_LAP_TRACE_KEYS) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, record] of map) {
      const at = record.recordedAt ?? 0;
      if (at < oldestAt) {
        oldestAt = at;
        oldestKey = key;
      }
    }
    if (oldestKey === null) return;
    map.delete(oldestKey);
    logger.warn(
      `[Main] Lap trace cap (${MAX_LAP_TRACE_KEYS}) reached; pruned ${oldestKey}`
    );
  }
};

/**
 * Read a stored lap trace. Returns null rather than throwing when nothing is
 * stored or the file is unreadable (R6.4).
 */
export const getLapTrace = async (
  trackId: number,
  carPath: string,
  kind: LapTraceSource
): Promise<LapTraceRecord | null> => {
  const key = generateKey(trackId, carPath, kind);
  const map = await loadCache();
  return map.get(key) ?? null;
};

/**
 * Store a lap trace. The cache is updated as soon as it is loaded, so a read
 * issued after this resolves sees the record; the disk write is debounced.
 */
export const saveLapTrace = async (
  trackId: number,
  carPath: string,
  kind: LapTraceSource,
  record: LapTraceRecord
): Promise<void> => {
  const key = generateKey(trackId, carPath, kind);
  const map = await loadCache();
  map.set(key, record);
  pruneToCap(map);
  scheduleWrite();
};

/** Remove a stored lap trace, if present. */
export const clearLapTrace = async (
  trackId: number,
  carPath: string,
  kind: LapTraceSource
): Promise<void> => {
  const key = generateKey(trackId, carPath, kind);
  const map = await loadCache();
  if (map.delete(key)) {
    scheduleWrite();
  }
};

/**
 * Flush any pending write asynchronously — called on app shutdown. The
 * before-quit coordinator awaits this within its deadline, so the last save
 * survives without a synchronous write racing the queue.
 */
export const flushLapTracesOnShutdown = flushPendingWrites;

/** Testing helper: await any in-flight write. */
export const __awaitPendingLapTraceWrite = async (): Promise<void> => {
  await flushPendingWrites();
};

/** Testing helper: reset module-level state so each spec starts clean. */
export const __resetLapTracesForTests = (): void => {
  cache = null;
  loading = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  writeInFlight = null;
};
