import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { isActiveSimulator, type ActiveSimulator } from '@irdashies/types';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

const FILE_NAME = 'simulator-usage.json';
/**
 * How often a running connection's time is saved, so a crash or a forced
 * shutdown loses at most this much of it.
 */
const CHECKPOINT_INTERVAL_MS = 60 * 1000;
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

export interface SimulatorUsageEntry {
  /** When the simulator last connected, in milliseconds since the epoch. */
  at: number;
  /** How long it has been connected since the last report, in milliseconds. */
  ms: number;
}

/**
 * The simulators used since the last report: one entry per simulator at
 * most, so the list cannot grow.
 */
export type SimulatorUsage = Partial<
  Record<ActiveSimulator, SimulatorUsageEntry>
>;

const isTime = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum;

/** The simulators in a stored value, leaving out anything malformed. */
export const parseSimulatorUsage = (stored: unknown): SimulatorUsage => {
  const usage: SimulatorUsage = {};
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return usage;
  }
  for (const [simulator, entry] of Object.entries(stored)) {
    if (!isActiveSimulator(simulator)) continue;
    if (typeof entry !== 'object' || entry === null) continue;
    const { at, ms } = entry as Record<string, unknown>;
    if (isTime(at, 1) && isTime(ms, 0)) usage[simulator] = { at, ms };
  }
  return usage;
};

/**
 * Keeps the list in memory and lets the file follow. Every change is
 * synchronous, so a connect can never interleave with a report clearing what
 * it sent. Each connect gets a time later than every one the store holds, and
 * clearing subtracts the time that was sent, which is how the report tells
 * what it carried from what came after.
 */
export function createSimulatorUsageStore(storageDir: string) {
  const filePath = path.join(storageDir, FILE_NAME);
  let usage: SimulatorUsage = {};
  /** The connection running now, in this process only. */
  let open: { simulator: ActiveSimulator; since: number } | undefined;
  let checkpointTimer: ReturnType<typeof setInterval> | undefined;
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
        // What was noted while the file loaded is newer, the sim already
        // running as irdashies started for one: its connect time wins, and
        // its time adds to what the file held.
        const merged: SimulatorUsage = { ...stored };
        for (const simulator of Object.keys(usage) as ActiveSimulator[]) {
          const noted = usage[simulator];
          if (!noted) continue;
          merged[simulator] = {
            at: noted.at,
            ms: (stored[simulator]?.ms ?? 0) + noted.ms,
          };
        }
        usage = merged;
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

  /** Moves the running connection's time so far into its entry. */
  const settleOpen = (now: number): boolean => {
    if (!open) return false;
    const entry = usage[open.simulator];
    usage = {
      ...usage,
      [open.simulator]: {
        at: entry?.at ?? now,
        ms: (entry?.ms ?? 0) + Math.max(0, now - open.since),
      },
    };
    open = { ...open, since: now };
    return true;
  };

  const checkpoint = (): void => {
    if (settleOpen(Date.now())) save();
  };

  return {
    /**
     * A copy of the list, once the stored one is loaded, with the running
     * connection's time counted up to `now`.
     */
    async read(now?: number): Promise<SimulatorUsage> {
      await load();
      if (settleOpen(now ?? Date.now())) save();
      return { ...usage };
    },
    /**
     * Notes the simulator connected now, or none. A change ends the running
     * connection, and a new simulator starts one, with a connect time later
     * than every time already noted, even if the clock stood still or went
     * back.
     */
    setConnected(
      simulator: ActiveSimulator | undefined,
      now = Date.now()
    ): void {
      if (open?.simulator === simulator) return;
      settleOpen(now);
      open = undefined;
      clearInterval(checkpointTimer);
      checkpointTimer = undefined;
      if (simulator) {
        const latest = Math.max(
          0,
          ...Object.values(usage).map((entry) => entry?.at ?? 0)
        );
        usage = {
          ...usage,
          [simulator]: {
            at: Math.max(now, latest + 1),
            ms: usage[simulator]?.ms ?? 0,
          },
        };
        open = { simulator, since: now };
        checkpointTimer = setInterval(checkpoint, CHECKPOINT_INTERVAL_MS);
        checkpointTimer.unref?.();
      }
      save();
    },
    /**
     * Takes away what a report sent. An entry stays while anything is left:
     * time counted after the report read it, a connect since then, or the
     * connection still running.
     */
    removeReported(reported: SimulatorUsage): void {
      const remaining: SimulatorUsage = {};
      let changed = false;
      for (const simulator of Object.keys(usage) as ActiveSimulator[]) {
        const entry = usage[simulator];
        const sent = reported[simulator];
        if (!entry) continue;
        if (!sent) {
          remaining[simulator] = entry;
          continue;
        }
        const ms = Math.max(0, entry.ms - sent.ms);
        const done =
          entry.at === sent.at && ms === 0 && open?.simulator !== simulator;
        if (!done) remaining[simulator] = { at: entry.at, ms };
        if (done || ms !== entry.ms) changed = true;
      }
      if (!changed) return;
      usage = remaining;
      save();
    },
    /** Saves now, the running connection's time included. */
    async flush(now?: number): Promise<void> {
      if (loaded) {
        await loaded;
        if (settleOpen(now ?? Date.now()) && !saveBlocked) writer.schedule();
      }
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
