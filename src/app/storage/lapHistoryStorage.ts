import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { LapHistorySnapshot } from '@irdashies/types';
import logger from '../logger';

/**
 * Persisted form of a LapHistorySnapshot. The snapshot is already plain
 * JSON-safe data, so it is written as-is behind a schema marker.
 */
export interface PersistedLapHistory {
  schema: 1;
  history: LapHistorySnapshot;
}

const SCHEMA_VERSION = 1;

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return path.join(app.getPath('userData'), 'lap-history');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `lap-history-${sessionId}.json`);
}

function getPathForLog(filePath: string): string {
  return path.basename(filePath);
}

function hasSessionId(sessionId: string): boolean {
  if (sessionId.trim()) return true;
  logger.warn('[LapHistoryStorage] Ignored operation without a session ID');
  return false;
}

/**
 * Debounce window for the lap-history write. Longer than the project default
 * (R6.2) because the payload is the whole field's history and crossings arrive
 * roughly once a second. Worst case loss on a hard kill is a few crossings.
 */
const WRITE_DEBOUNCE_MS = 2_000;

/** Retention: the current race plus one previous race. Older files are pruned. */
const PREVIOUS_SESSIONS_KEPT = 1;

let tempFileSequence = 0;

function getTempFilePath(filePath: string): string {
  tempFileSequence += 1;
  return `${filePath}.${process.pid}.${tempFileSequence}.tmp`;
}

interface SessionCache {
  filePath: string;
  /** Live snapshot. Serialised at write time, never copied per crossing. */
  snapshot: LapHistorySnapshot | null;
  writeTimer: NodeJS.Timeout | null;
  writeInFlight: Promise<void> | null;
  deleting: boolean;
}

/** Per-session caches keep concurrent session operations isolated. */
const caches = new Map<string, SessionCache>();
const removals = new Map<string, Promise<void>>();
const pendingSaves = new Set<Promise<void>>();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberArray = (value: unknown, length: number): boolean =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(isFiniteNumber);

const isLapHistorySnapshot = (value: unknown): value is LapHistorySnapshot => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.carCount) || candidate.carCount <= 0) {
    return false;
  }
  if (!isFiniteNumber(candidate.capacity) || candidate.capacity <= 0) {
    return false;
  }
  if (candidate.sessionNum !== null && !isFiniteNumber(candidate.sessionNum)) {
    return false;
  }
  const slots = candidate.carCount * candidate.capacity;
  if (
    !isNumberArray(candidate.count, candidate.carCount) ||
    !isNumberArray(candidate.start, candidate.carCount) ||
    !isNumberArray(candidate.lap, slots) ||
    !isNumberArray(candidate.sessionTime, slots) ||
    !isNumberArray(candidate.classPosition, slots) ||
    !isNumberArray(candidate.flags, slots)
  ) {
    return false;
  }

  // Ring indices decide which slots are read. A bad pair repeats crossings or
  // reads another car's slots, so reject the file rather than decode it.
  return isRingIndexed(
    candidate.count as number[],
    candidate.start as number[],
    candidate.capacity
  );
};

const isRingIndexed = (
  count: readonly number[],
  start: readonly number[],
  capacity: number
): boolean => {
  for (let i = 0; i < count.length; i += 1) {
    if (!Number.isInteger(count[i]) || count[i] < 0 || count[i] > capacity) {
      return false;
    }
    if (!Number.isInteger(start[i]) || start[i] < 0 || start[i] >= capacity) {
      return false;
    }
  }
  return true;
};

const isPersistedLapHistory = (
  value: unknown
): value is PersistedLapHistory => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schema === SCHEMA_VERSION &&
    isLapHistorySnapshot(candidate.history)
  );
};

export function serializeLapHistory(
  snapshot: LapHistorySnapshot
): PersistedLapHistory {
  return { schema: SCHEMA_VERSION, history: snapshot };
}

/** The snapshot exposes its buffers read-only; writers hold the real arrays. */
const writable = (values: readonly number[]): number[] => values as number[];

function copyInto(target: readonly number[], source: readonly number[]): void {
  const out = writable(target);
  for (let i = 0; i < out.length; i += 1) out[i] = source[i] ?? 0;
}

/**
 * Copies stored crossings into a live snapshot's preallocated buffers, so a
 * running processor can be rehydrated in place. Returns false when the stored
 * layout does not fit the target.
 */
export function rehydrateLapHistory(
  stored: PersistedLapHistory,
  target: LapHistorySnapshot
): boolean {
  const { history } = stored;
  if (
    history.capacity !== target.capacity ||
    history.carCount !== target.carCount
  ) {
    logger.warn(
      `[LapHistoryStorage] Ignored history sized ${history.carCount}x${history.capacity}; target holds ${target.carCount}x${target.capacity}`
    );
    return false;
  }
  copyInto(target.count, history.count);
  copyInto(target.start, history.start);
  copyInto(target.lap, history.lap);
  copyInto(target.sessionTime, history.sessionTime);
  copyInto(target.classPosition, history.classPosition);
  copyInto(target.flags, history.flags);
  target.sessionNum = history.sessionNum;
  return true;
}

async function readLapHistoryFile(
  filePath: string
): Promise<PersistedLapHistory | null> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(
        '[LapHistoryStorage] Failed to read lap history file:',
        getPathForLog(filePath),
        err
      );
    }
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedLapHistory(parsed)) return parsed;
    logger.warn(
      '[LapHistoryStorage] Lap history file has an invalid shape:',
      getPathForLog(filePath)
    );
    return null;
  } catch (err) {
    logger.warn(
      '[LapHistoryStorage] Failed to parse lap history file:',
      getPathForLog(filePath),
      err
    );
    return null;
  }
}

async function writeToDisk(filePath: string, payload: string): Promise<void> {
  const tempFilePath = getTempFilePath(filePath);
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(tempFilePath, payload);
    await fsp.rename(tempFilePath, filePath);
  } catch (err) {
    logger.error('[LapHistoryStorage] Failed to write lap history file:', err);
    await fsp.unlink(tempFilePath).catch(() => undefined);
  }
}

/** Serialises the cached snapshot and writes it, tracked so callers can wait. */
function runFlush(entry: SessionCache): Promise<void> {
  const snapshot = entry.snapshot;
  if (!snapshot) return entry.writeInFlight ?? Promise.resolve();
  // Stringify now: the snapshot keeps mutating while the write is in flight.
  const payload = JSON.stringify(serializeLapHistory(snapshot));
  const task = (entry.writeInFlight ?? Promise.resolve()).then(() =>
    writeToDisk(entry.filePath, payload)
  );
  const trackedTask = task.finally(() => {
    if (entry.writeInFlight === trackedTask) entry.writeInFlight = null;
  });
  entry.writeInFlight = trackedTask;
  return trackedTask;
}

/** Cancels any debounce timer and flushes/awaits whatever write is pending. */
async function flushPending(entry: SessionCache): Promise<void> {
  if (entry.writeTimer) {
    clearTimeout(entry.writeTimer);
    entry.writeTimer = null;
    await runFlush(entry);
    return;
  }
  if (entry.writeInFlight) {
    await entry.writeInFlight;
  }
}

function scheduleWrite(entry: SessionCache): void {
  if (entry.deleting) return;
  if (entry.writeTimer) clearTimeout(entry.writeTimer);
  entry.writeTimer = setTimeout(() => {
    entry.writeTimer = null;
    void runFlush(entry);
  }, WRITE_DEBOUNCE_MS);
}

async function ensureCache(filePath: string): Promise<SessionCache> {
  const removal = removals.get(filePath);
  if (removal) await removal;
  const cached = caches.get(filePath);
  if (cached) return cached;
  const entry: SessionCache = {
    filePath,
    snapshot: null,
    writeTimer: null,
    writeInFlight: null,
    deleting: false,
  };
  caches.set(filePath, entry);
  return entry;
}

export async function loadLapHistory(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<PersistedLapHistory | null> {
  if (!hasSessionId(sessionId)) return null;
  return readLapHistoryFile(getFilePath(sessionId, storageDir));
}

async function saveLapHistoryInternal(
  sessionId: string,
  snapshot: LapHistorySnapshot,
  storageDir: string
): Promise<void> {
  if (!hasSessionId(sessionId)) return;
  const filePath = getFilePath(sessionId, storageDir);
  const entry = await ensureCache(filePath);
  entry.snapshot = snapshot;
  scheduleWrite(entry);
}

/** Debounced. The snapshot is serialised when the write fires, not here. */
export function saveLapHistory(
  sessionId: string,
  snapshot: LapHistorySnapshot,
  storageDir = getStorageDir()
): Promise<void> {
  const operation = saveLapHistoryInternal(sessionId, snapshot, storageDir);
  pendingSaves.add(operation);
  return operation.finally(() => pendingSaves.delete(operation));
}

export async function clearLapHistory(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<void> {
  if (!hasSessionId(sessionId)) return;
  const filePath = getFilePath(sessionId, storageDir);

  const entry = caches.get(filePath);
  if (entry) {
    await flushPending(entry);
    entry.snapshot = null;
  }

  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(
        '[LapHistoryStorage] Failed to delete lap history file:',
        err
      );
    }
  }
}

export async function listSessionFiles(
  storageDir = getStorageDir()
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fsp.readdir(storageDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(
        '[LapHistoryStorage] Failed to list session files:',
        getPathForLog(storageDir),
        err
      );
    }
    return [];
  }

  const candidates = entries
    .filter((f) => f.startsWith('lap-history-') && f.endsWith('.json'))
    .map((f) => path.join(storageDir, f));

  const stats = await Promise.all(
    candidates.map(async (fullPath) => {
      try {
        const { mtimeMs } = await fsp.stat(fullPath);
        return { fullPath, mtime: mtimeMs };
      } catch {
        return null;
      }
    })
  );

  return stats
    .filter((s): s is { fullPath: string; mtime: number } => s !== null)
    .sort((a, b) => a.mtime - b.mtime || a.fullPath.localeCompare(b.fullPath))
    .map(({ fullPath }) => fullPath);
}

async function deleteSessionFile(filePath: string): Promise<void> {
  const entry = caches.get(filePath);
  if (entry) {
    entry.deleting = true;
    if (entry.writeTimer) {
      clearTimeout(entry.writeTimer);
      entry.writeTimer = null;
    }
  }
  const removal = (async () => {
    if (entry?.writeInFlight) await entry.writeInFlight;
    try {
      await fsp.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error(
          '[LapHistoryStorage] Failed to delete old session file:',
          err
        );
      }
    } finally {
      if (caches.get(filePath) === entry) caches.delete(filePath);
    }
  })();
  removals.set(filePath, removal);
  try {
    await removal;
  } finally {
    if (removals.get(filePath) === removal) removals.delete(filePath);
  }
}

/**
 * Keeps the current race plus one previous race and deletes the rest. The
 * current session is never a prune candidate, so this is safe to call before
 * its first write has landed.
 */
export async function pruneOldSessions(
  currentSessionId: string,
  storageDir = getStorageDir()
): Promise<void> {
  const currentFilePath = currentSessionId.trim()
    ? getFilePath(currentSessionId, storageDir)
    : null;
  const files = (await listSessionFiles(storageDir)).filter(
    (f) => f !== currentFilePath
  );
  const toDelete = files.slice(
    0,
    Math.max(0, files.length - PREVIOUS_SESSIONS_KEPT)
  );
  for (const filePath of toDelete) {
    await deleteSessionFile(filePath);
  }
}

/**
 * Waits for saves and older writes before persisting the final snapshots.
 * The caller must postpone Electron shutdown until this promise resolves.
 */
export async function flushLapHistoryOnShutdown(): Promise<void> {
  while (pendingSaves.size > 0) {
    await Promise.all([...pendingSaves]);
  }
  for (const entry of caches.values()) {
    if (entry.writeTimer) {
      clearTimeout(entry.writeTimer);
      entry.writeTimer = null;
    }
  }
  await Promise.all([...caches.values()].map((entry) => runFlush(entry)));
}

/**
 * Test-only: forces any scheduled/in-flight write to complete so specs can
 * assert on-disk state without depending on the real debounce delay.
 */
export async function __awaitPendingWrite(): Promise<void> {
  await Promise.all([...caches.values()].map(flushPending));
}

/** Test-only: resets module state between specs. */
export function __resetForTests(): void {
  for (const entry of caches.values()) {
    if (entry.writeTimer) clearTimeout(entry.writeTimer);
  }
  caches.clear();
  removals.clear();
  pendingSaves.clear();
  tempFileSequence = 0;
}
