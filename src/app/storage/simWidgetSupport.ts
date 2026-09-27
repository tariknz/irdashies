import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  normalizeSimWidgetSupport,
  type SimWidgetSupportConfig,
} from '@irdashies/types';
import logger from '../logger';

/**
 * Its own file rather than a key in config.json: this is a list a user is
 * expected to open and edit by hand, and config.json is machine-written on
 * every settings change.
 */
const FILENAME = 'simWidgetSupport.json';

const filePath = () => path.join(app.getPath('userData'), FILENAME);

let cached: SimWidgetSupportConfig | undefined;
let loading: Promise<SimWidgetSupportConfig> | undefined;

/** Reads the file, seeding it with the defaults when it is not there yet. */
const readConfig = async (): Promise<SimWidgetSupportConfig> => {
  let target: string;
  try {
    target = filePath();
  } catch (error) {
    // Resolving the user-data path can fail before the app is ready. This is
    // consulted on every window build, so it falls back rather than taking
    // window creation down with it.
    logger.error(
      `[simWidgetSupport] Failed to resolve ${FILENAME} path`,
      error
    );
    return { ...DEFAULT_SIM_WIDGET_SUPPORT };
  }

  try {
    return normalizeSimWidgetSupport(
      JSON.parse(await fs.readFile(target, 'utf8'))
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      // A malformed file must not take the app down; fall back to the defaults
      // and say so, because the user's edit is silently not in effect.
      logger.error(`[simWidgetSupport] Failed to read ${FILENAME}`, error);
      return { ...DEFAULT_SIM_WIDGET_SUPPORT };
    }
  }

  const seeded = { ...DEFAULT_SIM_WIDGET_SUPPORT };
  try {
    await fs.writeFile(target, JSON.stringify(seeded, null, 2));
    logger.info(`[simWidgetSupport] Created ${FILENAME} with defaults`);
  } catch (error) {
    logger.error(`[simWidgetSupport] Failed to create ${FILENAME}`, error);
  }
  return seeded;
};

/**
 * Loads the list into the cache, or hands back the load already in flight.
 *
 * Called once during startup, before any window is built, so the synchronous
 * reads below never have to touch the disk. Concurrent callers share the one
 * read; a failed read still resolves, to the defaults, so a broken file cannot
 * wedge every later caller.
 */
export const loadSimWidgetSupport = (): Promise<SimWidgetSupportConfig> => {
  if (cached) return Promise.resolve(cached);
  loading ??= readConfig().then((config) => {
    cached = config;
    loading = undefined;
    return config;
  });
  return loading;
};

/**
 * The cached list, for the synchronous callers on the window-build path.
 *
 * Falls back to the bundled defaults if it is somehow asked before the load
 * has landed: a widget shown that a hand-edited file would have hidden is a
 * far smaller wrong than blocking the main process on a disk read.
 */
export const getSimWidgetSupport = (): SimWidgetSupportConfig =>
  cached ?? DEFAULT_SIM_WIDGET_SUPPORT;

/** Drops the cache so the next load picks the file up again. Tests only. */
export const resetSimWidgetSupportCache = (): void => {
  cached = undefined;
  loading = undefined;
};
