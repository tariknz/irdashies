import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import logger from '../logger';
import {
  createSimulatorUsageStore,
  parseSimulatorUsage,
  type SimulatorUsageStore,
} from './simulatorUsage';

vi.mock('electron', () => ({ app: {} }));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));

const FILE = 'simulator-usage.json';
const DAY_MS = 24 * 60 * 60 * 1000;
let directory: string;
let filePath: string;
/** The store's monotonic clock, moved by hand. */
let now: number;
let store: SimulatorUsageStore;
const createStore = () => createSimulatorUsageStore(directory, () => now);
const stored = async () => JSON.parse(await fsp.readFile(filePath, 'utf8'));
const writeStored = (value: unknown) =>
  fsp.writeFile(filePath, JSON.stringify(value));
const afterWriteDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 400));
const take = async (target = store) => {
  await target.ready();
  return target.takeForReport();
};
const busy = () => Object.assign(new Error('busy'), { code: 'EBUSY' });

beforeEach(async () => {
  directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-simulator-usage-')
  );
  filePath = path.join(directory, FILE);
  now = 1000;
  store = createStore();
  vi.mocked(logger.warn).mockClear();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  store.setConnected(undefined);
  await store.flush();
  // directory is the exact mkdtemp result, never a real application profile.
  await fsp.rm(directory, { recursive: true, force: true });
});

describe('parseSimulatorUsage', () => {
  it('leaves out anything malformed', () => {
    for (const value of ['lmu', 42, null, ['lmu'], true, undefined]) {
      expect(parseSimulatorUsage(value)).toEqual({});
    }
    expect(
      parseSimulatorUsage({
        iracing: { first: 1, last: 2, ms: 5000 },
        lmu: 2000,
        rf2: { first: 1, last: 1, ms: 5000 },
      })
    ).toEqual({ iracing: { first: 1, last: 2, ms: 5000 } });
    expect(
      parseSimulatorUsage({
        iracing: { first: 0, last: 1, ms: 5000 },
        lmu: { first: 1, last: 1.5, ms: 5000 },
      })
    ).toEqual({});
    expect(parseSimulatorUsage({ lmu: { first: 1, last: 1 } })).toEqual({});
    expect(parseSimulatorUsage({ lmu: { first: 1, last: 1, ms: -1 } })).toEqual(
      {}
    );
    expect(
      parseSimulatorUsage({ lmu: { first: 1, last: 1, ms: Number.NaN } })
    ).toEqual({});
    // The wall-clock format this replaced.
    expect(parseSimulatorUsage({ lmu: { at: 1000, ms: 5000 } })).toEqual({});
  });

  it('caps an absurd duration at a month', () => {
    expect(
      parseSimulatorUsage({ lmu: { first: 1, last: 1, ms: 1e15 } })
    ).toEqual({ lmu: { first: 1, last: 1, ms: 31 * DAY_MS } });
  });
});

describe('simulator usage store', () => {
  it('starts empty without a file, and writes none', async () => {
    expect(await take()).toEqual({});
    await store.flush();
    await expect(fsp.access(filePath)).rejects.toThrow();
  });

  it('counts how long each simulator is connected, and saves it', async () => {
    store.setConnected('iracing');
    now += 60_000;
    store.setConnected(undefined);
    now += 10_000;
    store.setConnected('lmu');
    now += 30_000;
    // Straight to another sim: LMU's connection ends there.
    store.setConnected('iracing');
    now += 10_000;
    store.setConnected(undefined);
    const expected = {
      iracing: { first: 1, last: 3, ms: 70_000 },
      lmu: { first: 2, last: 2, ms: 30_000 },
    };
    await store.flush();
    expect(await stored()).toEqual(expected);
    expect(await take(createStore())).toEqual(expected);
  });

  it('keeps the first connect in place when a simulator reconnects', async () => {
    store.setConnected('iracing');
    store.setConnected('lmu');
    store.setConnected('iracing');
    store.setConnected(undefined);
    expect(await take()).toEqual({
      iracing: { first: 1, last: 3, ms: 0 },
      lmu: { first: 2, last: 2, ms: 0 },
    });
  });

  it('ignores a repeat of the connection already running', async () => {
    store.setConnected('lmu');
    now += 4000;
    store.setConnected('lmu');
    now += 6000;
    store.setConnected(undefined);
    expect(await take()).toEqual({ lmu: { first: 1, last: 1, ms: 10_000 } });
  });

  it('runs no timer while a simulator is in use', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    store.setConnected('lmu');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts a long use in full when it ends', async () => {
    store.setConnected('lmu');
    now += 5 * 60 * 60_000;
    store.setConnected(undefined);
    expect(await take()).toEqual({
      lmu: { first: 1, last: 1, ms: 5 * 60 * 60_000 },
    });
  });

  it('saves a running connection on flush, as on quit', async () => {
    store.setConnected('lmu');
    now += 30_000;
    await store.flush();
    expect(await stored()).toEqual({ lmu: { first: 1, last: 1, ms: 30_000 } });
  });

  it('ranks what was noted while the file loaded after everything it held', async () => {
    // The sim already running as irdashies started: its bridge reports it
    // before anything has read the file.
    await writeStored({
      iracing: { first: 1, last: 4, ms: 5000 },
      lmu: { first: 2, last: 3, ms: 7000 },
    });
    store.setConnected('lmu');
    now += 1000;
    store.setConnected(undefined);
    const expected = {
      iracing: { first: 1, last: 4, ms: 5000 },
      lmu: { first: 2, last: 5, ms: 8000 },
    };
    await store.flush();
    expect(await stored()).toEqual(expected);
    expect(await take()).toEqual(expected);
  });

  it('gives a simulator first seen while the file loaded a place after the file', async () => {
    await writeStored({ iracing: { first: 1, last: 2, ms: 5000 } });
    store.setConnected('lmu');
    store.setConnected(undefined);
    expect(await take()).toEqual({
      iracing: { first: 1, last: 2, ms: 5000 },
      lmu: { first: 3, last: 3, ms: 0 },
    });
  });

  it('does not save over the file before it has loaded', async () => {
    await writeStored({ iracing: { first: 1, last: 1, ms: 5000 } });
    const readFile = fsp.readFile.bind(fsp);
    let finishLoading: (() => void) | undefined;
    vi.spyOn(fsp, 'readFile').mockImplementationOnce((async (
      ...args: Parameters<typeof fsp.readFile>
    ) => {
      await new Promise<void>((resolve) => {
        finishLoading = resolve;
      });
      return readFile(...args);
    }) as typeof fsp.readFile);

    store.setConnected('lmu');
    now += 1000;
    store.setConnected(undefined);
    // Well past the write delay, with the file still loading.
    await afterWriteDelay();
    expect(store.takeForReport()).toBeUndefined();
    expect(await stored()).toEqual({
      iracing: { first: 1, last: 1, ms: 5000 },
    });

    finishLoading?.();
    await store.flush();
    expect(await stored()).toEqual({
      iracing: { first: 1, last: 1, ms: 5000 },
      lmu: { first: 2, last: 2, ms: 1000 },
    });
  });

  it('hands over the list for a report and starts a new one', async () => {
    store.setConnected('iracing');
    store.setConnected('lmu');
    now += 2000;
    store.setConnected(undefined);
    expect(await take()).toEqual({
      iracing: { first: 1, last: 1, ms: 0 },
      lmu: { first: 2, last: 2, ms: 2000 },
    });
    expect(store.takeForReport()).toEqual({});
    await store.flush();
    expect(await stored()).toEqual({});
  });

  it('keeps counting a connection still running after the report', async () => {
    store.setConnected('lmu');
    now += 10_000;
    expect(await take()).toEqual({ lmu: { first: 1, last: 1, ms: 10_000 } });
    now += 20_000;
    store.setConnected(undefined);
    // The next report takes the rest.
    expect(store.takeForReport()).toEqual({
      lmu: { first: 1, last: 1, ms: 20_000 },
    });
    expect(store.takeForReport()).toEqual({});
  });

  it('starts over from a file that is not JSON', async () => {
    await fsp.writeFile(filePath, '{not json');
    store.setConnected('lmu');
    now += 1000;
    await store.flush();
    expect(await stored()).toEqual({ lmu: { first: 1, last: 1, ms: 1000 } });
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Invalid JSON',
      FILE
    );
  });

  it('tries a failed read again, and keeps what it noted meanwhile', async () => {
    // A scanner holding the file at startup.
    await writeStored({ iracing: { first: 1, last: 1, ms: 5000 } });
    vi.spyOn(fsp, 'readFile').mockRejectedValueOnce(busy());
    store.setConnected('lmu');
    now += 1000;
    store.setConnected(undefined);
    await afterWriteDelay();
    expect(await stored()).toEqual({
      iracing: { first: 1, last: 1, ms: 5000 },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Failed to read',
      FILE,
      'EBUSY'
    );

    // The next save reads it again, and this time it works.
    store.setConnected('lmu');
    store.setConnected(undefined);
    await store.flush();
    expect(await stored()).toEqual({
      iracing: { first: 1, last: 1, ms: 5000 },
      lmu: { first: 2, last: 3, ms: 1000 },
    });
  });

  it('leaves a file it cannot read alone, and says what was not saved', async () => {
    // A directory in its place never reads; it may hold sims this session
    // never saw.
    await fsp.mkdir(filePath);
    store.setConnected('lmu');
    now += 1000;
    expect(await store.ready()).toBe(false);
    expect(store.takeForReport()).toBeUndefined();
    await store.flush();
    expect((await fsp.stat(filePath)).isDirectory()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Failed to read',
      FILE,
      expect.any(String)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Not saved: could not read',
      FILE
    );
    // Logged once, however often it is tried.
    await store.ready();
    expect(
      vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) => message.includes('Failed to read'))
    ).toHaveLength(1);
  });

  it('forgets everything on clear, stops the clock, and deletes the file', async () => {
    await writeStored({ iracing: { first: 1, last: 1, ms: 5000 } });
    store.setConnected('lmu');
    now += 1000;
    await store.flush();
    expect(Object.keys(await stored()).sort()).toEqual(['iracing', 'lmu']);

    await store.clear();
    await expect(fsp.access(filePath)).rejects.toThrow();
    now += 60_000;
    await store.flush();
    await expect(fsp.access(filePath)).rejects.toThrow();
    expect(store.takeForReport()).toEqual({});
  });

  it('drops what the file held when cleared while it loads', async () => {
    await writeStored({ iracing: { first: 1, last: 1, ms: 5000 } });
    store.setConnected('lmu');
    await store.clear();
    expect(await take()).toEqual({});
    await store.flush();
    await expect(fsp.access(filePath)).rejects.toThrow();
  });
});
