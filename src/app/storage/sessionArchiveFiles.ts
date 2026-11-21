import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import logger from '../logger';

interface ArchiveWriteState {
  deleting: boolean;
  writeTimer: NodeJS.Timeout | null;
  writeInFlight: Promise<void> | null;
}

export async function listArchiveFiles(
  storageDir: string,
  prefix: string,
  logLabel: string
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fsp.readdir(storageDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(
        `${logLabel} Failed to list session files:`,
        path.basename(storageDir),
        err
      );
    }
    return [];
  }

  const candidates = entries.filter(
    (name) => name.startsWith(prefix) && name.endsWith('.json')
  );
  const stats = await Promise.all(
    candidates.map(async (name) => {
      const fullPath = path.join(storageDir, name);
      try {
        const { mtimeMs } = await fsp.stat(fullPath);
        return { fullPath, mtime: mtimeMs };
      } catch {
        return null;
      }
    })
  );
  return stats
    .filter((entry) => entry !== null)
    .sort((a, b) => a.mtime - b.mtime || a.fullPath.localeCompare(b.fullPath))
    .map(({ fullPath }) => fullPath);
}

export async function pruneArchiveFile<T extends ArchiveWriteState>(
  filePath: string,
  caches: Map<string, T>,
  removals: Map<string, Promise<void>>,
  logLabel: string
): Promise<void> {
  const pending = removals.get(filePath);
  if (pending) return pending;

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
        logger.error(`${logLabel} Failed to delete old session file:`, err);
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
