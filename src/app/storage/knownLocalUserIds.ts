import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import logger from '../logger';

/**
 * iRacing customer ids seen driving or spectating live on this PC. A replay
 * whose DriverUserID is in this list was recorded here.
 *
 * Kept in its own file rather than config.json: config.json is written with a
 * synchronous read-modify-write, and an async write to the same file could
 * undo a setting saved in between.
 */
const FILE_NAME = 'known-local-user-ids.json';

/** Cap: the ten most recently seen ids, newest first. */
export const MAX_KNOWN_LOCAL_USER_IDS = 10;

const WRITE_DEBOUNCE_MS = 250;

interface PersistedKnownLocalUserIds {
  knownLocalUserIds: number[];
}

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return app.getPath('userData');
}

const isUserId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** Moves `id` to the front, drops duplicates and applies the cap. */
export const withKnownUserId = (ids: readonly number[], id: number): number[] =>
  [id, ...ids.filter((known) => known !== id)].slice(
    0,
    MAX_KNOWN_LOCAL_USER_IDS
  );

const sanitize = (value: unknown): number[] | null => {
  if (!value || typeof value !== 'object') return null;
  const ids = (value as Partial<PersistedKnownLocalUserIds>).knownLocalUserIds;
  if (!Array.isArray(ids)) return null;
  return [...new Set(ids.filter(isUserId))].slice(0, MAX_KNOWN_LOCAL_USER_IDS);
};

export interface KnownLocalUserIdStore {
  has(userId: number): boolean;
  /** Records an id. Writes are debounced. Returns true when the list changed. */
  remember(userId: number): boolean;
  /** Reads the file. Resolves with [] on any error. */
  load(): Promise<readonly number[]>;
  /** Writes any pending change now. */
  flush(): Promise<void>;
}

export function createKnownLocalUserIdStore(
  storageDir?: string
): KnownLocalUserIdStore {
  let ids: number[] = [];
  let loaded: Promise<readonly number[]> | null = null;
  let dirty = false;
  let writeTimer: NodeJS.Timeout | null = null;
  let writeInFlight: Promise<void> = Promise.resolve();
  const filePath = () => path.join(storageDir ?? getStorageDir(), FILE_NAME);

  const read = async (): Promise<number[]> => {
    const target = filePath();
    try {
      const parsed: unknown = JSON.parse(await fsp.readFile(target, 'utf-8'));
      const sanitized = sanitize(parsed);
      if (sanitized) return sanitized;
      logger.warn('[KnownLocalUserIds] Invalid file shape:', FILE_NAME);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('[KnownLocalUserIds] Failed to read', FILE_NAME, err);
      }
    }
    return [];
  };

  const load = (): Promise<readonly number[]> => {
    loaded ??= read().then((stored) => {
      // Ids remembered while the read was in flight stay newest.
      ids = ids.reduceRight(withKnownUserId, stored);
      return ids;
    });
    return loaded;
  };

  const write = async (): Promise<void> => {
    // Merge the file first so a write never drops ids saved earlier.
    await load();
    if (!dirty) return;
    dirty = false;
    const target = filePath();
    const payload = JSON.stringify({
      knownLocalUserIds: ids,
    } satisfies PersistedKnownLocalUserIds);
    const temp = `${target}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(temp, payload);
      await fsp.rename(temp, target);
    } catch (err) {
      logger.error('[KnownLocalUserIds] Failed to write', FILE_NAME, err);
      await fsp.unlink(temp).catch(() => undefined);
    }
  };

  const queueWrite = () => {
    writeInFlight = writeInFlight.then(write);
    return writeInFlight;
  };

  return {
    has: (userId) => ids.includes(userId),

    remember(userId) {
      if (!isUserId(userId) || ids[0] === userId) return false;
      ids = withKnownUserId(ids, userId);
      dirty = true;
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        writeTimer = null;
        void queueWrite();
      }, WRITE_DEBOUNCE_MS);
      return true;
    },

    load,

    flush() {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
        return queueWrite();
      }
      return writeInFlight;
    },
  };
}
