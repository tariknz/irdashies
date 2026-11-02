import { app } from 'electron';
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

/** Error logs reach analytics: a filesystem error carries the user's path. */
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

const WRITE_DEBOUNCE_MS = 250;

let pending: PoleSideOverrides | undefined;
let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> = Promise.resolve();

/** The file exists but could not be read: saving would replace good data. */
let saveBlocked = false;

const write = async (): Promise<void> => {
  const overrides = pending;
  pending = undefined;
  if (!overrides || saveBlocked) return;
  const temp = `${filePath()}.${process.pid}.tmp`;
  try {
    await fsp.writeFile(temp, JSON.stringify(overrides));
    await fsp.rename(temp, filePath());
  } catch (error) {
    logger.error('[RadarPoleSide] Failed to write', errorCode(error));
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
  }
  // A write that failed left its correction pending with no timer.
  return writeInFlight.then(() => (pending ? queueWrite() : undefined));
};

let stored: unknown;
let loaded: Promise<boolean> | undefined;

const READ_RETRY_MS = 50;

const readFile = async (): Promise<string | undefined> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsp.readFile(filePath(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      // A virus scanner can hold the file for a moment on Windows.
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, READ_RETRY_MS));
        continue;
      }
      saveBlocked = true;
      logger.error('[RadarPoleSide] Failed to read', errorCode(error));
      return undefined;
    }
  }
};

/**
 * Reads the file once, ahead of the radar, which looks corrections up
 * synchronously. Everything that reads corrections awaits this first.
 * Resolves false when the file exists but could not be used.
 */
export const loadRadarPoleSideOverrides = (): Promise<boolean> =>
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
      // Not JSON: keep it aside rather than lose it under the next save.
      logger.error('[RadarPoleSide] Invalid file, moved aside');
      await fsp.rename(filePath(), `${filePath()}.invalid`).catch(() => {
        saveBlocked = true;
      });
    }
    return !saveBlocked;
  })());

/** The player's pole side corrections, kept in a small file of their own. */
export const radarPoleSideOverrides = new RadarPoleSideOverrides({
  read: () => stored,
  write: (overrides) => {
    pending = overrides;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void queueWrite();
    }, WRITE_DEBOUNCE_MS);
  },
});
