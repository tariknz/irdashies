import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>()
);

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/user/data') },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler),
  },
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile, writeFile: mockWriteFile },
}));

import {
  __resetForTests,
  flushRadarPoleSidesOnShutdown,
  listRadarPoleSides,
  loadRadarPoleSides,
  loadRadarPoleSidesFile,
  saveRadarPoleSide,
} from './radarPoleSides';
import { setupRadarBridge } from '../bridge/radarBridge';

const written = () =>
  JSON.parse(mockWriteFile.mock.calls.at(-1)?.[1] as string) as unknown;

describe('radarPoleSides', () => {
  beforeEach(() => {
    __resetForTests();
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(
      Object.assign(new Error('missing'), { code: 'ENOENT' })
    );
  });

  it('loads the file once and drops malformed entries', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        Spa: { grid: 'right', pace: 'sideways' },
        Junk: 'left',
      })
    );
    await loadRadarPoleSidesFile();
    await loadRadarPoleSidesFile();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(listRadarPoleSides()).toEqual({ Spa: { grid: 'right' } });
  });

  it('saves without touching the disk until the debounced flush', async () => {
    await loadRadarPoleSidesFile();
    saveRadarPoleSide('Spa', 'grid', 'right');
    saveRadarPoleSide('Spa', 'pace', 'left');
    expect(loadRadarPoleSides('Spa')).toEqual({ grid: 'right', pace: 'left' });
    expect(mockWriteFile).not.toHaveBeenCalled();

    await flushRadarPoleSidesOnShutdown();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(written()).toEqual({ Spa: { grid: 'right', pace: 'left' } });
  });

  it('keeps a side learnt before the file finished loading', async () => {
    let resolve!: (text: string) => void;
    mockReadFile.mockReturnValue(new Promise((r) => (resolve = r)));
    const loading = loadRadarPoleSidesFile();
    saveRadarPoleSide('Spa', 'grid', 'left');
    resolve(
      JSON.stringify({ Spa: { grid: 'right' }, Monza: { pace: 'left' } })
    );
    await loading;
    expect(listRadarPoleSides()).toEqual({
      Spa: { grid: 'left' },
      Monza: { pace: 'left' },
    });
  });

  describe('radar:setPoleSide IPC', () => {
    beforeEach(() => setupRadarBridge());
    const setPoleSide = (...args: unknown[]) =>
      handlers.get('radar:setPoleSide')?.({}, ...args);

    it('sets and forgets a side', async () => {
      setPoleSide('Spa', 'grid', 'right');
      setPoleSide('Spa', 'pace', 'left');
      setPoleSide('Spa', 'pace', null);
      expect(listRadarPoleSides()).toEqual({ Spa: { grid: 'right' } });
      setPoleSide('Spa', 'grid', null);
      expect(listRadarPoleSides()).toEqual({});
      await flushRadarPoleSidesOnShutdown();
      expect(written()).toEqual({});
    });

    it.each([
      ['an unknown kind', ['Spa', 'toString', 'left']],
      ['an unknown side', ['Spa', 'grid', 'invalid']],
      ['a missing side', ['Spa', 'grid']],
      ['a non-string track', [42, 'grid', 'left']],
      ['an empty track', ['  ', 'grid', 'left']],
      ['an oversized track', ['x'.repeat(201), 'grid', 'left']],
    ])('rejects %s', async (_, args) => {
      setPoleSide(...args);
      expect(listRadarPoleSides()).toEqual({});
      await flushRadarPoleSidesOnShutdown();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
