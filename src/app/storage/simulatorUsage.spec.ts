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

beforeEach(async () => {
  directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-simulator-usage-')
  );
  filePath = path.join(directory, FILE);
  store = createSimulatorUsageStore(directory);
  vi.mocked(logger.warn).mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
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
        iracing: 1000,
        lmu: 'yesterday',
        rf2: 2000,
      })
    ).toEqual({ iracing: 1000 });
    expect(parseSimulatorUsage({ lmu: Number.NaN, iracing: 0 })).toEqual({});
    expect(parseSimulatorUsage({ lmu: -1 })).toEqual({});
  });
});

describe('simulator usage store', () => {
  it('starts empty without a file, and writes none', async () => {
    expect(await store.read()).toEqual({});
    await store.flush();
    await expect(fsp.access(filePath)).rejects.toThrow();
  });

  it('notes each simulator with the time it last connected, and saves it', async () => {
    store.add('iracing', 1000);
    store.add('lmu', 2000);
    store.add('iracing', 3000);
    await store.flush();
    expect(await stored()).toEqual({ iracing: 3000, lmu: 2000 });
    expect(await createSimulatorUsageStore(directory).read()).toEqual({
      iracing: 3000,
      lmu: 2000,
    });
  });

  it('keeps every time unique while the clock stands still or goes back', async () => {
    store.add('iracing', 5000);
    store.add('iracing', 5000);
    expect(await store.read()).toEqual({ iracing: 5001 });
    store.add('lmu', 4000);
    expect(await store.read()).toEqual({ iracing: 5001, lmu: 5002 });
  });

  it('keeps a connect noted while the file was loading, and what the file held', async () => {
    // The sim already running as irdashies started: its bridge reports it
    // before anything has read the file.
    await fsp.writeFile(filePath, JSON.stringify({ iracing: 1000, lmu: 2000 }));
    store.add('lmu', 9000);
    expect(await store.read()).toEqual({ iracing: 1000, lmu: 9000 });
    await store.flush();
    expect(await stored()).toEqual({ iracing: 1000, lmu: 9000 });
  });

  it('does not save over the file before it has loaded', async () => {
    await fsp.writeFile(filePath, JSON.stringify({ iracing: 1000 }));
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

    store.add('lmu', 9000);
    // Well past the write delay, with the file still loading.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await stored()).toEqual({ iracing: 1000 });

    finishLoading?.();
    await store.flush();
    expect(await stored()).toEqual({ iracing: 1000, lmu: 9000 });
  });

  it('removes what a report sent', async () => {
    store.add('iracing', 1000);
    store.add('lmu', 2000);
    store.removeReported(await store.read());
    expect(await store.read()).toEqual({});
    await store.flush();
    expect(await stored()).toEqual({});
  });

  it('keeps a connect that came in while the report was in flight', async () => {
    store.add('iracing', 1000);
    const reported = await store.read();
    // While the report is out: iRacing connects again, LMU for the first time.
    store.add('iracing', 1000);
    store.add('lmu', 3000);
    store.removeReported(reported);
    expect(await store.read()).toEqual({ iracing: 1001, lmu: 3000 });
    await store.flush();
    expect(await stored()).toEqual({ iracing: 1001, lmu: 3000 });
  });

  it('does not write when the report carried nothing still stored', async () => {
    await fsp.writeFile(filePath, JSON.stringify({ iracing: 1000 }));
    store.removeReported({ iracing: 999 });
    store.removeReported({});
    await store.flush();
    expect(await fsp.readFile(filePath, 'utf8')).toBe('{"iracing":1000}');
  });

  it('starts over from a file that is not JSON', async () => {
    await fsp.writeFile(filePath, '{not json');
    store.add('lmu', 1000);
    await store.flush();
    expect(await stored()).toEqual({ lmu: 1000 });
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Invalid JSON',
      FILE
    );
  });

  it('leaves a file it cannot read alone', async () => {
    // A directory in its place fails the read with something other than
    // "missing"; it may hold sims this session never saw.
    await fsp.mkdir(filePath);
    store.add('lmu', 1000);
    expect(await store.read()).toEqual({ lmu: 1000 });
    await store.flush();
    expect((await fsp.stat(filePath)).isDirectory()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      '[SimulatorUsage] Failed to read',
      FILE,
      expect.any(String)
    );
  });
});
