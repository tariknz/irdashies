import { app } from 'electron';
import { readFileSync } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import {
  RadarPoleSideOverrides,
  type PoleSideOverrides,
} from '../radarPoleSideOverrides';

/**
 * Its own file rather than config.json: config.json is written with a
 * synchronous read-modify-write, and an async write to it could undo a
 * setting saved in between.
 */
const filePath = () =>
  path.join(app.getPath('userData'), 'radar-pole-side-overrides.json');

const WRITE_DEBOUNCE_MS = 250;

let pending: PoleSideOverrides | undefined;
let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> = Promise.resolve();

const write = async (): Promise<void> => {
  const overrides = pending;
  pending = undefined;
  if (!overrides) return;
  const temp = `${filePath()}.${process.pid}.tmp`;
  try {
    await fsp.writeFile(temp, JSON.stringify(overrides));
    await fsp.rename(temp, filePath());
  } catch (error) {
    logger.error('[RadarPoleSide] Failed to write', filePath(), error);
    // Keep the correction for the next write, unless a newer one came in.
    pending ??= overrides;
    await fsp.unlink(temp).catch(() => undefined);
  }
};

const queueWrite = (): Promise<void> => {
  writeInFlight = writeInFlight.then(write);
  return writeInFlight;
};

/** Writes any pending correction now; the before-quit coordinator awaits it. */
export const flushRadarPoleSideOverrides = (): Promise<void> => {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    return queueWrite();
  }
  return writeInFlight;
};

/** The player's pole side corrections, kept in a small file of their own. */
export const radarPoleSideOverrides = new RadarPoleSideOverrides({
  // shortcut: one sync read of a tiny file, on first use; make it async if
  // the override lookup ever becomes awaitable.
  read: () => {
    try {
      return JSON.parse(readFileSync(filePath(), 'utf8')) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('[RadarPoleSide] Failed to read', filePath(), error);
      }
      return undefined;
    }
  },
  write: (overrides) => {
    pending = overrides;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void queueWrite();
    }, WRITE_DEBOUNCE_MS);
  },
});
