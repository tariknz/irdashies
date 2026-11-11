import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { isActiveSimulator, type ActiveSimulator } from '@irdashies/types';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

const FILE_NAME = 'simulator-usage.json';
/**
 * The most a simulator can carry into one report: a month. Anything above it
 * in the file is damage, not use.
 */
const MAX_USAGE_MS = 31 * 24 * 60 * 60 * 1000;
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

export interface SimulatorUsageEntry {
  /**
   * Place in connection order of its first connect since the last report: 1,
   * 2, 3, not a time. A reconnect does not move it.
   */
  first: number;
  /** Place in connection order of its latest connect. */
  last: number;
  /** How long it has been in use since the last report, in milliseconds. */
  ms: number;
}

/**
 * The simulators used since the last report: one entry per simulator at
 * most, so the list cannot grow.
 */
export type SimulatorUsage = Partial<
  Record<ActiveSimulator, SimulatorUsageEntry>
>;

const isPlace = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 1;

/** The simulators in a stored value, leaving out anything malformed. */
export const parseSimulatorUsage = (stored: unknown): SimulatorUsage => {
  const usage: SimulatorUsage = {};
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return usage;
  }
  for (const [simulator, entry] of Object.entries(stored)) {
    if (!isActiveSimulator(simulator)) continue;
    if (typeof entry !== 'object' || entry === null) continue;
    const { first, last, ms } = entry as Record<string, unknown>;
    if (!isPlace(first) || !isPlace(last)) continue;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) continue;
    usage[simulator] = { first, last, ms: Math.min(ms, MAX_USAGE_MS) };
  }
  return usage;
};

/** The latest place in connection order the list holds, 0 when empty. */
const latestPlace = (usage: SimulatorUsage): number =>
  Math.max(0, ...Object.values(usage).map((entry) => entry?.last ?? 0));

/**
 * The stored list with what this process noted before it loaded. Those
 * connects are newer than anything stored, so they rank after it; their time
 * adds to what the file held.
 */
const mergeNoted = (
  stored: SimulatorUsage,
  noted: SimulatorUsage
): SimulatorUsage => {
  const offset = latestPlace(stored);
  const merged: SimulatorUsage = { ...stored };
  for (const simulator of Object.keys(noted) as ActiveSimulator[]) {
    const entry = noted[simulator];
    if (!entry) continue;
    const earlier = stored[simulator];
    merged[simulator] = {
      first: earlier?.first ?? entry.first + offset,
      last: entry.last + offset,
      ms: Math.min(MAX_USAGE_MS, (earlier?.ms ?? 0) + entry.ms),
    };
  }
  return merged;
};

/**
 * Keeps the list in memory and lets the file follow, once the file has been
 * read: until then nothing is written, so an early connect cannot overwrite
 * what the file holds. A read that fails is tried again at the next save.
 *
 * Nothing runs while a simulator is in use: no timer, no polling. Its time is
 * counted when the use ends, at a report, and at quit, so a crash loses the
 * use running at the time.
 *
 * Durations come from `clock`, a monotonic clock, so a change of the wall
 * clock does not count as use.
 */
export function createSimulatorUsageStore(
  storageDir: string,
  clock: () => number = () => performance.now()
) {
  const filePath = path.join(storageDir, FILE_NAME);
  let usage: SimulatorUsage = {};
  /** The use running now, in this process only. */
  let open: { simulator: ActiveSimulator; since: number } | undefined;
  let loaded = false;
  let loading: Promise<boolean> | undefined;
  /** Counts clears, so a save queued before one cannot write after it. */
  let clears = 0;
  /** The last read failure logged, so a retry every minute logs it once. */
  let loggedReadError: string | undefined;
  const writer = createDebouncedAtomicWriter({
    filePath,
    serialize: () => JSON.stringify(usage),
    onSuccess: () => undefined,
    onError: (error) =>
      logger.warn(
        '[SimulatorUsage] Failed to write',
        FILE_NAME,
        errorCode(error)
      ),
  });

  /** Whether the file has been read, reading it if not. */
  const load = (): Promise<boolean> => {
    if (loaded) return Promise.resolve(true);
    return (loading ??= (async () => {
      let stored: SimulatorUsage = {};
      try {
        stored = parseSimulatorUsage(
          JSON.parse(await fsp.readFile(filePath, 'utf8'))
        );
      } catch (error) {
        if (error instanceof SyntaxError) {
          logger.warn('[SimulatorUsage] Invalid JSON', FILE_NAME);
        } else if (errorCode(error) !== 'ENOENT') {
          // Often a scanner holding the file for a moment. It may hold sims
          // this session never saw, so wait for a read that works.
          if (loggedReadError !== errorCode(error)) {
            loggedReadError = errorCode(error);
            logger.warn(
              '[SimulatorUsage] Failed to read',
              FILE_NAME,
              errorCode(error)
            );
          }
          loading = undefined;
          return false;
        }
      }
      loading = undefined;
      // Cleared meanwhile: what the file held goes with the rest.
      if (!loaded) usage = mergeNoted(stored, usage);
      loaded = true;
      return true;
    })());
  };

  const save = (): void => {
    if (loaded) {
      writer.schedule();
      return;
    }
    const generation = clears;
    void load().then((ok) => {
      if (ok && generation === clears) writer.schedule();
    });
  };

  /** Moves the running use's time so far into its entry. */
  const settleOpen = (): boolean => {
    if (!open) return false;
    const now = clock();
    const entry = usage[open.simulator];
    if (entry) {
      const elapsed = Math.max(0, now - open.since);
      usage = {
        ...usage,
        [open.simulator]: {
          ...entry,
          ms: Math.min(MAX_USAGE_MS, entry.ms + elapsed),
        },
      };
    }
    open = { ...open, since: now };
    return true;
  };

  return {
    /**
     * Waits for the stored list to be read. False when it could not be, for
     * now: the list then stays where it is, for a later report.
     */
    ready: load,
    /**
     * Hands over the list for a report and starts a new one, once the file
     * has been read; undefined before that. The running use is counted up to
     * now, and stays, with nothing counted yet.
     */
    takeForReport(): SimulatorUsage | undefined {
      if (!loaded) return undefined;
      settleOpen();
      const taken = usage;
      usage = open ? { [open.simulator]: { first: 1, last: 1, ms: 0 } } : {};
      if (Object.keys(taken).length > 0) save();
      return taken;
    },
    /**
     * Notes the simulator in use now, or none. A change ends the running use,
     * and a new simulator starts one, next in connection order.
     */
    setConnected(simulator: ActiveSimulator | undefined): void {
      if (open?.simulator === simulator) return;
      settleOpen();
      open = undefined;
      if (simulator) {
        const place = latestPlace(usage) + 1;
        const entry = usage[simulator];
        usage = {
          ...usage,
          [simulator]: {
            first: entry?.first ?? place,
            last: place,
            ms: entry?.ms ?? 0,
          },
        };
        open = { simulator, since: clock() };
      }
      save();
    },
    /**
     * Forgets everything, the running use included, and deletes the file:
     * for an opt-out, after which nothing is noted.
     */
    async clear(): Promise<void> {
      open = undefined;
      usage = {};
      loaded = true;
      clears += 1;
      try {
        // Lets a write already under way land first, so it cannot bring the
        // file back after it is deleted.
        await writer.flush();
        if (open || Object.keys(usage).length > 0) return;
        await fsp.rm(filePath, { force: true });
      } catch (error) {
        logger.warn(
          '[SimulatorUsage] Failed to clear',
          FILE_NAME,
          errorCode(error)
        );
      }
    },
    /** Saves now, the running use's time included. */
    async flush(): Promise<void> {
      const noted = open !== undefined || Object.keys(usage).length > 0;
      if (!loaded && !noted) return;
      if (!(await load())) {
        logger.warn('[SimulatorUsage] Not saved: could not read', FILE_NAME);
        return;
      }
      if (settleOpen()) writer.schedule();
      await writer.flush();
    },
  };
}

export type SimulatorUsageStore = ReturnType<typeof createSimulatorUsageStore>;

let store: SimulatorUsageStore | undefined;

/** The installation's store, loaded on first use. */
export const getSimulatorUsageStore = (): SimulatorUsageStore =>
  (store ??= createSimulatorUsageStore(app.getPath('userData')));

export const flushSimulatorUsageOnShutdown = async (): Promise<void> => {
  await store?.flush();
};
