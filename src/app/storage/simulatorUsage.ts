import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { isActiveSimulator, type ActiveSimulator } from '@irdashies/types';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

const FILE_NAME = 'simulator-usage.json';
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

/**
 * The simulators that connected since the last report PostHog acknowledged,
 * each with the time it last connected, in milliseconds since the epoch. One
 * entry per simulator at most, so the list cannot grow.
 */
export type SimulatorUsage = Partial<Record<ActiveSimulator, number>>;

/** The simulators in a stored value, leaving out anything malformed. */
export const parseSimulatorUsage = (stored: unknown): SimulatorUsage => {
  const usage: SimulatorUsage = {};
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return usage;
  }
  for (const [simulator, at] of Object.entries(stored)) {
    if (
      isActiveSimulator(simulator) &&
      typeof at === 'number' &&
      Number.isFinite(at) &&
      at > 0
    ) {
      usage[simulator] = at;
    }
  }
  return usage;
};

/**
 * Keeps the list in memory and lets the file follow. Every change is
 * synchronous, so a connect can never interleave with a report clearing what
 * it sent; and each connect gets a time later than every one the store holds,
 * which is how the report tells a new connect from the one it sent.
 */
export function createSimulatorUsageStore(storageDir: string) {
  const filePath = path.join(storageDir, FILE_NAME);
  let usage: SimulatorUsage = {};
  let loaded: Promise<void> | undefined;
  let saveBlocked = false;
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

  const load = (): Promise<void> =>
    (loaded ??= (async () => {
      try {
        const stored = parseSimulatorUsage(
          JSON.parse(await fsp.readFile(filePath, 'utf8'))
        );
        // A connect noted while the file was loading is newer than anything
        // in it: the sim already running as irdashies started, for one.
        usage = { ...stored, ...usage };
      } catch (error) {
        if (error instanceof SyntaxError) {
          logger.warn('[SimulatorUsage] Invalid JSON', FILE_NAME);
        } else if (errorCode(error) !== 'ENOENT') {
          // It may hold sims this session never saw; leave it for next time.
          saveBlocked = true;
          logger.warn(
            '[SimulatorUsage] Failed to read',
            FILE_NAME,
            errorCode(error)
          );
        }
      }
    })());

  /** Only once the file is loaded, so an early connect cannot overwrite it. */
  const save = (): void => {
    void load().then(() => {
      if (!saveBlocked) writer.schedule();
    });
  };

  return {
    /** A copy of the list, once the stored one is loaded. */
    async read(): Promise<SimulatorUsage> {
      await load();
      return { ...usage };
    },
    /**
     * Notes that a simulator connected. The time is later than every time
     * already noted, even if the clock stood still or went back.
     */
    add(simulator: ActiveSimulator, now = Date.now()): void {
      const latest = Math.max(
        0,
        ...Object.values(usage).filter((at) => at !== undefined)
      );
      usage = { ...usage, [simulator]: Math.max(now, latest + 1) };
      save();
    },
    /**
     * Removes what an acknowledged report sent. An entry whose time moved on
     * while the report was in flight is a connect the report did not carry,
     * so it stays for the next one.
     */
    removeReported(reported: SimulatorUsage): void {
      const remaining: SimulatorUsage = {};
      for (const simulator of Object.keys(usage) as ActiveSimulator[]) {
        if (usage[simulator] !== reported[simulator]) {
          remaining[simulator] = usage[simulator];
        }
      }
      if (Object.keys(remaining).length === Object.keys(usage).length) return;
      usage = remaining;
      save();
    },
    async flush(): Promise<void> {
      if (loaded) await loaded;
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
