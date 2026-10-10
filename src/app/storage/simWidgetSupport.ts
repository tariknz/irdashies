import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  SIM_WIDGET_SUPPORT_VERSION,
  normalizeSimWidgetSupportVerbose,
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
    const raw: unknown = JSON.parse(await fs.readFile(target, 'utf8'));
    // A file written by an older build describes which widgets worked then.
    // Honouring it would mean a shipped correction never reaching anyone who
    // had already run the app, which is how the LMU list sat empty while
    // widgets that cannot work under it stayed on offer. Replaced rather than
    // merged, because a widget moving off the list is as much of a correction
    // as one moving on to it, and a merge cannot express the former.
    const version = (raw as { version?: unknown })?.version;
    if (typeof version !== 'number' || version < SIM_WIDGET_SUPPORT_VERSION) {
      logger.info(
        `[simWidgetSupport] ${FILENAME} is from an older build; replacing it with this build's defaults`
      );
      return await seed(target);
    }
    const { config, problems } = normalizeSimWidgetSupportVerbose(raw);
    // Said out loud, because the file is edited by hand and a misspelled id
    // used to do nothing whatsoever: it matched no widget, so the widget it
    // was meant to hide stayed on screen and nothing anywhere said why.
    for (const { simulator, id } of problems.unknownWidgets) {
      logger.warn(
        `[simWidgetSupport] ${FILENAME} lists "${id}" under ${simulator}, which is not a widget in this build; ignoring it`
      );
    }
    // Sharper than it looks: a simulator the file does not mention falls back
    // to the shipped defaults, so a misspelled key does not disable nothing --
    // it quietly reinstates the whole bundled list.
    for (const key of problems.unknownSimulators) {
      logger.warn(
        `[simWidgetSupport] ${FILENAME} has a "${key}" section, which is not a known simulator; the defaults apply instead`
      );
    }
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      // A malformed file must not take the app down; fall back to the defaults
      // and say so, because the user's edit is silently not in effect.
      logger.error(`[simWidgetSupport] Failed to read ${FILENAME}`, error);
      return { ...DEFAULT_SIM_WIDGET_SUPPORT };
    }
  }

  return seed(target);
};

/**
 * Writes the shipped defaults to disk and hands them back.
 *
 * The version goes in the file rather than into SimWidgetSupportConfig: it is
 * about the file, not about which widgets work, and keeping it out means
 * nothing downstream of the config has to know the mechanism exists.
 *
 * A write that fails is logged and otherwise ignored -- the defaults are
 * returned either way, so the only cost is doing this again next launch.
 */
const seed = async (target: string): Promise<SimWidgetSupportConfig> => {
  const seeded = { ...DEFAULT_SIM_WIDGET_SUPPORT };
  try {
    await fs.writeFile(
      target,
      JSON.stringify(
        { version: SIM_WIDGET_SUPPORT_VERSION, ...seeded },
        null,
        2
      )
    );
    logger.info(`[simWidgetSupport] Wrote ${FILENAME} with defaults`);
  } catch (error) {
    logger.error(`[simWidgetSupport] Failed to write ${FILENAME}`, error);
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
