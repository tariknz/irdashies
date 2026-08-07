import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { Incident } from '../../types/raceControl';
import logger from '../logger';

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return path.join(app.getPath('userData'), 'incidents');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `incidents-${sessionId}.json`);
}

/**
 * Debounce window for the session-incidents write. A burst of incidents
 * (e.g. a multi-car pileup) collapses into a single write. Matches the
 * project default (ARCHITECTURE_RULES.md R6.2).
 */
const WRITE_DEBOUNCE_MS = 250;

interface SessionCache {
  filePath: string;
  incidents: Incident[];
}

/**
 * In-memory incidents for whichever session file was touched most recently.
 * Loaded lazily from disk once per file, then mutated directly so
 * appendIncident never re-reads the file — this is what turns session-long
 * incident logging from an O(n^2) read+parse-per-incident into O(n) writes.
 */
let cache: SessionCache | null = null;

let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> | null = null;

// Dedupes concurrent first-loads of the same file so two appendIncident
// calls racing before the cache is populated don't both read the file and
// clobber each other's in-memory push.
let loadingFilePath: string | null = null;
let loadingPromise: Promise<SessionCache> | null = null;

async function readIncidentsFile(filePath: string): Promise<Incident[]> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(
        '[IncidentStorage] Failed to read incident file:',
        filePath,
        err
      );
    }
    return [];
  }
  try {
    return JSON.parse(raw) as Incident[];
  } catch (err) {
    logger.warn(
      '[IncidentStorage] Failed to parse incident file:',
      filePath,
      err
    );
    return [];
  }
}

async function writeToDisk(
  filePath: string,
  incidents: Incident[]
): Promise<void> {
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, JSON.stringify(incidents));
  } catch (err) {
    logger.error('[IncidentStorage] Failed to write incident file:', err);
  }
}

/** Writes whatever is currently cached, tracked so callers can wait on it. */
function runFlush(): Promise<void> {
  const snapshot = cache;
  const task = snapshot
    ? writeToDisk(snapshot.filePath, [...snapshot.incidents])
    : Promise.resolve();
  writeInFlight = task.finally(() => {
    if (writeInFlight === task) writeInFlight = null;
  });
  return task;
}

/** Cancels any debounce timer and flushes/awaits whatever write is pending. */
async function flushPending(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    await runFlush();
    return;
  }
  if (writeInFlight) {
    await writeInFlight;
  }
}

/** Debounces the write so a burst of incidents produces a single flush. */
function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void runFlush();
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Ensures `cache` reflects `filePath`, loading from disk only on first touch
 * (or when the active session changes). Switching sessions flushes any
 * pending write for the outgoing session first, so a debounced write can
 * never land after the session has moved on.
 */
async function ensureCache(filePath: string): Promise<SessionCache> {
  if (cache && cache.filePath === filePath) return cache;
  if (loadingFilePath === filePath && loadingPromise) return loadingPromise;

  await flushPending();

  loadingFilePath = filePath;
  const promise = (async (): Promise<SessionCache> => {
    const incidents = await readIncidentsFile(filePath);
    const entry: SessionCache = { filePath, incidents };
    cache = entry;
    return entry;
  })();
  loadingPromise = promise;
  try {
    return await promise;
  } finally {
    if (loadingPromise === promise) {
      loadingPromise = null;
      loadingFilePath = null;
    }
  }
}

export async function loadIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<Incident[]> {
  const filePath = getFilePath(sessionId, storageDir);
  const entry = await ensureCache(filePath);
  return [...entry.incidents];
}

export async function appendIncident(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
): Promise<void> {
  const filePath = getFilePath(sessionId, storageDir);
  const entry = await ensureCache(filePath);
  entry.incidents.push(incident);
  scheduleWrite();
}

export async function clearIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<void> {
  const filePath = getFilePath(sessionId, storageDir);

  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (writeInFlight) {
    await writeInFlight;
  }
  if (cache && cache.filePath === filePath) {
    cache = { filePath, incidents: [] };
  }

  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('[IncidentStorage] Failed to delete incident file:', err);
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
        '[IncidentStorage] Failed to list session files:',
        storageDir,
        err
      );
    }
    return [];
  }

  const candidates = entries
    .filter((f) => f.startsWith('incidents-') && f.endsWith('.json'))
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
    .sort((a, b) => a.mtime - b.mtime)
    .map(({ fullPath }) => fullPath);
}

export async function pruneOldSessions(
  retention: 'all' | 5 | 10 | 20,
  storageDir = getStorageDir()
): Promise<void> {
  if (retention === 'all') return;
  const files = await listSessionFiles(storageDir);
  const toDelete = files.slice(0, Math.max(0, files.length - retention));
  await Promise.all(
    toDelete.map(async (f) => {
      try {
        await fsp.unlink(f);
        if (cache && cache.filePath === f) {
          cache = null;
        }
      } catch (err) {
        logger.error(
          '[IncidentStorage] Failed to delete old session file:',
          err
        );
      }
    })
  );
}

/**
 * Synchronous flush for app shutdown. `before-quit` handlers must complete
 * before Electron tears the process down, so this bypasses the debounce and
 * writes whatever is cached right now with sync fs — the one sanctioned use
 * of sync I/O here, matching referenceLaps.ts's shutdown flush.
 */
export function flushIncidentsOnShutdown(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!cache) return;
  try {
    fs.mkdirSync(path.dirname(cache.filePath), { recursive: true });
    fs.writeFileSync(cache.filePath, JSON.stringify(cache.incidents));
  } catch (err) {
    logger.error(
      '[IncidentStorage] Failed to flush incidents on shutdown:',
      err
    );
  }
}

/**
 * Test-only: forces any scheduled/in-flight write to complete so specs can
 * assert on-disk state without depending on the real debounce delay.
 */
export async function __awaitPendingWrite(): Promise<void> {
  await flushPending();
}

/** Test-only: resets module state between specs. */
export function __resetForTests(): void {
  cache = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  writeInFlight = null;
  loadingFilePath = null;
  loadingPromise = null;
}
