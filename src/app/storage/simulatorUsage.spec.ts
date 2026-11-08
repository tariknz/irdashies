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
let directory: string;
let filePath: string;
let store: SimulatorUsageStore;
const stored = async () => JSON.parse(await fsp.readFile(filePath, 'utf8'));
const writeStored = (value: unknown) =>
  fsp.writeFile(filePath, JSON.stringify(value));
const afterWriteDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 400));

beforeEach(async () => {
  directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-simulator-usage-')
  );
  filePath = path.join(directory, FILE);
  store = createSimulatorUsageStore(directory);
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
        iracing: { at: 1000, ms: 5000 },
        lmu: 2000,
        rf2: { at: 1000, ms: 5000 },
      })
    ).toEqual({ iracing: { at: 1000, ms: 5000 } });
    expect(
      parseSimulatorUsage({
        iracing: { at: 0, ms: 5000 },
        lmu: { at: 1000, ms: -1 },
      })
    ).toEqual({});
    expect(parseSimulatorUsage({ lmu: { at: 1000 } })).toEqual({});
    expect(parseSimulatorUsage({ lmu: { at: 1000, ms: Number.NaN } })).toEqual(
      {}
    );
  });
});

describe('simulator usage store', () => {
  it('starts empty without a file, and writes none', async () => {
    expect(await store.read()).toEqual({});
    await store.flush();
    await expect(fsp.access(filePath)).rejects.toThrow();
  });

  it('counts how long each simulator is connected, and saves it', async () => {
    store.setConnected('iracing', 1000);
    store.setConnected(undefined, 61_000);
    store.setConnected('lmu', 70_000);
    // Straight to another sim: LMU's connection ends there.
    store.setConnected('iracing', 100_000);
    store.setConnected(undefined, 110_000);
    const expected = {
      iracing: { at: 100_000, ms: 70_000 },
      lmu: { at: 70_000, ms: 30_000 },
    };
    expect(await store.read()).toEqual(expected);
    await store.flush();
    expect(await stored()).toEqual(expected);
    expect(await createSimulatorUsageStore(directory).read()).toEqual(expected);
  });

  it('counts a running connection up to the read, and keeps counting', async () => {
    store.setConnected('lmu', 1000);
    expect(await store.read(11_000)).toEqual({ lmu: { at: 1000, ms: 10_000 } });
    store.setConnected(undefined, 21_000);
    expect(await store.read()).toEqual({ lmu: { at: 1000, ms: 20_000 } });
  });

  it('ignores a repeat of the connection already running', async () => {
    store.setConnected('lmu', 1000);
    store.setConnected('lmu', 5000);
    store.setConnected(undefined, 11_000);
    expect(await store.read()).toEqual({ lmu: { at: 1000, ms: 10_000 } });
  });

  it("saves a running connection's time every minute", async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(1_000_000);
    store.setConnected('lmu');
    vi.advanceTimersByTime(60_000);
    // Without a flush or a disconnect: what a crash would leave behind.
    await afterWriteDelay();
    expect(await stored()).toEqual({ lmu: { at: 1_000_000, ms: 60_000 } });
  });

  it('saves a running connection on flush, as on quit', async () => {
    store.setConnected('lmu', 1000);
    await store.flush(31_000);
    expect(await stored()).toEqual({ lmu: { at: 1000, ms: 30_000 } });
  });

  it('keeps every connect time unique while the clock stands still or goes back', async () => {
    store.setConnected('iracing', 5000);
    store.setConnected(undefined, 5000);
    store.setConnected('iracing', 5000);
    store.setConnected('lmu', 4000);
    store.setConnected(undefined, 4000);
    expect(await store.read()).toEqual({
      iracing: { at: 5001, ms: 0 },
      lmu: { at: 5002, ms: 0 },
    });
  });

  it('adds to what the file held what was noted while it loaded', async () => {
    // The sim already running as irdashies started: its bridge reports it
    // before anything has read the file.
    await writeStored({
      iracing: { at: 1000, ms: 5000 },
      lmu: { at: 2000, ms: 7000 },
    });
    store.setConnected('lmu', 9000);
    store.setConnected(undefined, 10_000);
    const expected = {
      iracing: { at: 1000, ms: 5000 },
      lmu: { at: 9000, ms: 8000 },
    };
    expect(await store.read()).toEqual(expected);
    await store.flush();
    expect(await stored()).toEqual(expected);
  });

  it('does not save over the file before it has loaded', async () => {
    await writeStored({ iracing: { at: 1000, ms: 5000 } });
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

    store.setConnected('lmu', 9000);
    store.setConnected(undefined, 10_000);
    // Well past the write delay, with the file still loading.
    await afterWriteDelay();
    expect(await stored()).toEqual({ iracing: { at: 1000, ms: 5000 } });

    finishLoading?.();
    await store.flush();
    expect(await stored()).toEqual({
      iracing: { at: 1000, ms: 5000 },
      lmu: { at: 9000, ms: 1000 },
    });
  });

  it('removes what a report sent', async () => {
    store.setConnected('iracing', 1000);
    store.setConnected('lmu', 2000);
    store.setConnected(undefined, 3000);
    store.removeReported(await store.read());
    expect(await store.read()).toEqual({});
    await store.flush();
    expect(await stored()).toEqual({});
  });

  it('keeps what came in while the report was in flight', async () => {
    store.setConnected('iracing', 1000);
    store.setConnected(undefined, 2000);
    const reported = await store.read();
    // While the report is out: iRacing connects again, LMU for the first time.
    store.setConnected('iracing', 3000);
    store.setConnected(undefined, 4000);
    store.setConnected('lmu', 5000);
    store.setConnected(undefined, 6000);
    store.removeReported(reported);
    expect(await store.read()).toEqual({
      iracing: { at: 3000, ms: 1000 },
      lmu: { at: 5000, ms: 1000 },
    });
  });

  it('keeps counting a connection still running after the report', async () => {
    store.setConnected('lmu', 1000);
    store.removeReported(await store.read(11_000));
    expect(await store.read(11_000)).toEqual({ lmu: { at: 1000, ms: 0 } });
    store.setConnected(undefined, 31_000);
    expect(await store.read()).toEqual({ lmu: { at: 1000, ms: 20_000 } });
    // The next report takes the rest.
    store.removeReported(await store.read());
    expect(await store.read()).toEqual({});
  });

  it('keeps the time counted after the report read it', async () => {
    store.setConnected('lmu', 1000);
    const reported = await store.read(11_000);
    store.setConnected(undefined, 15_000);
    store.removeReported(reported);
    expect(await store.read()).toEqual({ lmu: { at: 1000, ms: 4000 } });
  });

  it('does not write when the report carried nothing still stored', async () => {
    await writeStored({ iracing: { at: 1000, ms: 0 } });
    await store.read();
    store.removeReported({ iracing: { at: 999, ms: 0 } });
    store.removeReported({});
    await store.flush();
    expect(await fsp.readFile(filePath, 'utf8')).toBe(
      '{"iracing":{"at":1000,"ms":0}}'
    );
  });

  it('starts over from a file that is not JSON', async () => {
    await fsp.writeFile(filePath, '{not json');
    store.setConnected('lmu', 1000);
    await store.flush(2000);
    expect(await stored()).toEqual({ lmu: { at: 1000, ms: 1000 } });
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Invalid JSON',
      FILE
    );
  });

  it('leaves a file it cannot read alone', async () => {
    // A directory in its place fails the read with something other than
    // "missing"; it may hold sims this session never saw.
    await fsp.mkdir(filePath);
    store.setConnected('lmu', 1000);
    expect(await store.read(2000)).toEqual({ lmu: { at: 1000, ms: 1000 } });
    await store.flush();
    expect((await fsp.stat(filePath)).isDirectory()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Failed to read',
      FILE,
      expect.any(String)
    );
  });
});
