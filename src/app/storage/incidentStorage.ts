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
/** Matches the renderer cap and bounds serialization cost in long sessions. */
const MAX_INCIDENTS_PER_SESSION = 2_000;
let tempFileSequence = 0;

function getTempFilePath(filePath: string): string {
  tempFileSequence += 1;
  return `${filePath}.${process.pid}.${tempFileSequence}.tmp`;
}

interface SessionCache {
  filePath: string;
  incidents: Incident[];
  writeTimer: NodeJS.Timeout | null;
  writeInFlight: Promise<void> | null;
}

/** Per-session caches keep concurrent session operations isolated. */
const caches = new Map<string, SessionCache>();

// Dedupes concurrent first-loads of the same file so two appendIncident
// calls racing before the cache is populated don't both read the file and
// clobber each other's in-memory push.
const loadingPromises = new Map<string, Promise<SessionCache>>();

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
  const tempFilePath = getTempFilePath(filePath);
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(tempFilePath, JSON.stringify(incidents));
    await fsp.rename(tempFilePath, filePath);
  } catch (err) {
    logger.error('[IncidentStorage] Failed to write incident file:', err);
    await fsp.unlink(tempFilePath).catch(() => undefined);
  }
}

/** Writes whatever is currently cached, tracked so callers can wait on it. */
function runFlush(entry: SessionCache): Promise<void> {
  const incidents = [...entry.incidents];
  const task = (entry.writeInFlight ?? Promise.resolve()).then(() =>
    writeToDisk(entry.filePath, incidents)
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

/** Debounces the write so a burst of incidents produces a single flush. */
function scheduleWrite(entry: SessionCache): void {
  if (entry.writeTimer) clearTimeout(entry.writeTimer);
  entry.writeTimer = setTimeout(() => {
    entry.writeTimer = null;
    void runFlush(entry);
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Returns the cache for `filePath`, loading it once on first touch.
 */
async function ensureCache(filePath: string): Promise<SessionCache> {
  const cached = caches.get(filePath);
  if (cached) return cached;
  const loading = loadingPromises.get(filePath);
  if (loading) return loading;

  const promise = (async (): Promise<SessionCache> => {
    const incidents = (await readIncidentsFile(filePath)).slice(
      -MAX_INCIDENTS_PER_SESSION
    );
    const entry: SessionCache = {
      filePath,
      incidents,
      writeTimer: null,
      writeInFlight: null,
    };
    caches.set(filePath, entry);
    return entry;
  })();
  loadingPromises.set(filePath, promise);
  try {
    return await promise;
  } finally {
    if (loadingPromises.get(filePath) === promise) {
      loadingPromises.delete(filePath);
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
  if (entry.incidents.length > MAX_INCIDENTS_PER_SESSION) {
    entry.incidents.splice(
      0,
      entry.incidents.length - MAX_INCIDENTS_PER_SESSION
    );
  }
  scheduleWrite(entry);
}

export async function clearIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<void> {
  const filePath = getFilePath(sessionId, storageDir);

  const entry = caches.get(filePath);
  if (entry) {
    await flushPending(entry);
    entry.incidents = [];
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
    .sort((a, b) => a.mtime - b.mtime || a.fullPath.localeCompare(b.fullPath))
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
        caches.delete(f);
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
  for (const entry of caches.values()) {
    if (entry.writeTimer) {
      clearTimeout(entry.writeTimer);
      entry.writeTimer = null;
    }
    const tempFilePath = getTempFilePath(entry.filePath);
    try {
      fs.mkdirSync(path.dirname(entry.filePath), { recursive: true });
      fs.writeFileSync(tempFilePath, JSON.stringify(entry.incidents));
      fs.renameSync(tempFilePath, entry.filePath);
    } catch (err) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // The temporary file may not have been created.
      }
      logger.error(
        '[IncidentStorage] Failed to flush incidents on shutdown:',
        err
      );
    }
  }
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
  loadingPromises.clear();
  tempFileSequence = 0;
}
