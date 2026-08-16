import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { IncidentType, type Incident } from '../../types/raceControl';
import logger from '../logger';

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return path.join(app.getPath('userData'), 'incidents');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `incidents-${sessionId}.json`);
}

function getPathForLog(filePath: string): string {
  return path.basename(filePath);
}

function hasSessionId(sessionId: string): boolean {
  if (sessionId.trim()) return true;
  logger.warn('[IncidentStorage] Ignored operation without a session ID');
  return false;
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
  deleting: boolean;
}

/** Per-session caches keep concurrent session operations isolated. */
const caches = new Map<string, SessionCache>();
const removals = new Map<string, Promise<void>>();
const pendingAppends = new Set<Promise<void>>();

// Dedupes concurrent first-loads of the same file so two appendIncident
// calls racing before the cache is populated don't both read the file and
// clobber each other's in-memory push.
const loadingPromises = new Map<string, Promise<SessionCache>>();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isIncident = (value: unknown): value is Incident => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    isFiniteNumber(candidate.carIdx) &&
    typeof candidate.driverName === 'string' &&
    typeof candidate.carNumber === 'string' &&
    typeof candidate.teamName === 'string' &&
    isFiniteNumber(candidate.sessionNum) &&
    isFiniteNumber(candidate.sessionTime) &&
    isFiniteNumber(candidate.lapNum) &&
    isFiniteNumber(candidate.replayFrameNum) &&
    Object.values(IncidentType).includes(candidate.type as IncidentType) &&
    isFiniteNumber(candidate.lapDistPct) &&
    isFiniteNumber(candidate.timestamp)
  );
};

async function readIncidentsFile(filePath: string): Promise<Incident[]> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(
        '[IncidentStorage] Failed to read incident file:',
        getPathForLog(filePath),
        err
      );
    }
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isIncident)) return parsed;
    logger.warn(
      '[IncidentStorage] Incident file has an invalid shape:',
      getPathForLog(filePath)
    );
    return [];
  } catch (err) {
    logger.warn(
      '[IncidentStorage] Failed to parse incident file:',
      getPathForLog(filePath),
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
  if (entry.deleting) return;
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
  const removal = removals.get(filePath);
  if (removal) await removal;
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
      deleting: false,
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
  if (!hasSessionId(sessionId)) return [];
  const filePath = getFilePath(sessionId, storageDir);
  const entry = await ensureCache(filePath);
  return [...entry.incidents];
}

async function appendIncidentInternal(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
): Promise<void> {
  if (!hasSessionId(sessionId)) return;
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

export function appendIncident(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
): Promise<void> {
  const operation = appendIncidentInternal(sessionId, incident, storageDir);
  pendingAppends.add(operation);
  return operation.finally(() => pendingAppends.delete(operation));
}

export async function clearIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Promise<void> {
  if (!hasSessionId(sessionId)) return;
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
        getPathForLog(storageDir),
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
      const entry = caches.get(f);
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
          await fsp.unlink(f);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error(
              '[IncidentStorage] Failed to delete old session file:',
              err
            );
          }
        } finally {
          if (caches.get(f) === entry) caches.delete(f);
        }
      })();
      removals.set(f, removal);
      try {
        await removal;
      } finally {
        if (removals.get(f) === removal) removals.delete(f);
      }
    })
  );
}

/**
 * Waits for appends and older writes before persisting the final snapshots.
 * The caller must postpone Electron shutdown until this promise resolves.
 */
export async function flushIncidentsOnShutdown(): Promise<void> {
  while (pendingAppends.size > 0) {
    await Promise.all([...pendingAppends]);
  }
  for (const entry of caches.values()) {
    if (entry.writeTimer) {
      clearTimeout(entry.writeTimer);
      entry.writeTimer = null;
    }
  }
  await Promise.all(
    [...caches.values()].map(async (entry) => {
      if (entry.writeInFlight) await entry.writeInFlight;
      await writeToDisk(entry.filePath, [...entry.incidents]);
    })
  );
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
  removals.clear();
  pendingAppends.clear();
  tempFileSequence = 0;
}
