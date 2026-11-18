import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import {
  LmuSectorBoundaryStore,
  type LmuSectorBoundaryRecords,
} from '../lmu/sectorBoundaryStore';

const filePath = () =>
  path.join(app.getPath('userData'), 'lmu-sector-boundaries.json');

/** Error logs reach analytics: a filesystem error carries the user's path. */
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

const WRITE_DEBOUNCE_MS = 250;
const READ_RETRY_MS = 50;

let pending: LmuSectorBoundaryRecords | undefined;
let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> = Promise.resolve();

/** The file exists but could not be read: saving would replace good data. */
let saveBlocked = false;

const write = async (): Promise<void> => {
  const records = pending;
  pending = undefined;
  if (!records || saveBlocked) return;
  const temp = `${filePath()}.${process.pid}.tmp`;
  try {
    await fsp.writeFile(temp, JSON.stringify(records));
    await fsp.rename(temp, filePath());
  } catch (error) {
    logger.error('[LmuSectorBoundaries] Failed to write', errorCode(error));
    pending ??= records;
    await fsp.unlink(temp).catch(() => undefined);
  }
};

const queueWrite = (): Promise<void> => {
  writeInFlight = writeInFlight.then(write);
  return writeInFlight;
};

/** Writes any pending measurement now; the before-quit coordinator awaits it. */
export const flushLmuSectorBoundaries = (): Promise<void> => {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  return writeInFlight.then(() => (pending ? queueWrite() : undefined));
};

let stored: unknown;
let loaded: Promise<boolean> | undefined;

const readFile = async (): Promise<string | undefined> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsp.readFile(filePath(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, READ_RETRY_MS));
        continue;
      }
      saveBlocked = true;
      logger.error('[LmuSectorBoundaries] Failed to read', errorCode(error));
      return undefined;
    }
  }
};

/**
 * Reads the file once. Everything that reads measurements awaits this first.
 * Resolves false when the file exists but could not be used.
 */
export const loadLmuSectorBoundaries = (): Promise<boolean> =>
  (loaded ??= (async () => {
    const text = await readFile();
    if (text === undefined) {
      stored = null;
      return !saveBlocked;
    }
    try {
      stored = JSON.parse(text) as unknown;
    } catch {
      stored = null;
      logger.error('[LmuSectorBoundaries] Invalid file, moved aside');
      await fsp.rename(filePath(), `${filePath()}.invalid`).catch(() => {
        saveBlocked = true;
      });
    }
    return !saveBlocked;
  })());

/** The sector starts the player measured in LMU, in a small file of their own. */
export const lmuSectorBoundaryStore = new LmuSectorBoundaryStore({
  read: () => stored,
  write: (records) => {
    pending = records;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void queueWrite();
    }, WRITE_DEBOUNCE_MS);
  },
});
