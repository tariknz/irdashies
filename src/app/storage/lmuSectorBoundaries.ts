import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import {
  LmuSectorBoundaryStore,
  type LmuSectorBoundaryRecords,
} from '../lmu/sectorBoundaryStore';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

const filePath = () =>
  path.join(app.getPath('userData'), 'lmu-sector-boundaries.json');

const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

const READ_RETRY_MS = 50;

let stored: unknown;
let loaded: Promise<boolean> | undefined;
let saveBlocked = false;
let saving: LmuSectorBoundaryRecords = {};
let writer: ReturnType<typeof createDebouncedAtomicWriter> | undefined;

const fileWriter = () =>
  (writer ??= createDebouncedAtomicWriter({
    filePath: filePath(),
    serialize: () => JSON.stringify(saving),
    onSuccess: () => undefined,
    onError: (error) =>
      logger.error('[LmuSectorBoundaries] Failed to write', errorCode(error)),
  }));

export const flushLmuSectorBoundaries = async (): Promise<void> => {
  await writer?.flush();
};

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

export const loadLmuSectorBoundaries = (): Promise<boolean> =>
  (loaded ??= (async () => {
    const text = await readFile();
    let parsed: unknown = null;
    if (text !== undefined) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        logger.error('[LmuSectorBoundaries] Invalid file, moved aside');
        await fsp.rename(filePath(), `${filePath()}.invalid`).catch(() => {
          saveBlocked = true;
        });
      }
    }
    stored = parsed;
    return !saveBlocked;
  })());

export const lmuSectorBoundaryStore = new LmuSectorBoundaryStore({
  read: () => stored,
  write: (records) => {
    if (saveBlocked) return;
    saving = records;
    fileWriter().schedule();
  },
});
