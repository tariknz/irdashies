import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
  },
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

import {
  getSimWidgetSupport,
  loadSimWidgetSupport,
  resetSimWidgetSupportCache,
} from './simWidgetSupport';

const notFound = () =>
  Object.assign(new Error('ENOENT'), { code: 'ENOENT' as const });

describe('simWidgetSupport storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    resetSimWidgetSupportCache();
  });

  it('serves the hand-edited file to both readers once loaded', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ message: 'nope', disabledWidgets: { lmu: ['input'] } })
    );

    const loaded = await loadSimWidgetSupport();

    expect(loaded.message).toBe('nope');
    expect(loaded.disabledWidgets.lmu).toEqual(['input']);
    // The window-build path reads synchronously; it must see the same answer
    // without going back to disk.
    expect(getSimWidgetSupport()).toBe(loaded);
  });

  it('falls back to the defaults before the load has landed', () => {
    // No disk read may happen on this path, so the only honest answer until the
    // load finishes is what the app ships with.
    expect(getSimWidgetSupport()).toEqual(DEFAULT_SIM_WIDGET_SUPPORT);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('seeds the file with the defaults when it is not there yet', async () => {
    mockReadFile.mockRejectedValue(notFound());

    const loaded = await loadSimWidgetSupport();

    expect(loaded).toEqual(DEFAULT_SIM_WIDGET_SUPPORT);
    const [target, contents] = mockWriteFile.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(target).toContain('simWidgetSupport.json');
    expect(JSON.parse(contents)).toEqual(DEFAULT_SIM_WIDGET_SUPPORT);
    // A missing file is the first run, not a fault.
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('falls back to the defaults when the file is malformed', async () => {
    mockReadFile.mockResolvedValue('{ not json');

    expect(await loadSimWidgetSupport()).toEqual(DEFAULT_SIM_WIDGET_SUPPORT);
    // The user's edit is silently not in effect, so it has to be said.
    expect(mockLoggerError).toHaveBeenCalled();
    // Nothing is overwritten: the file is theirs to repair.
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('reads the file once however many callers ask at once', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(DEFAULT_SIM_WIDGET_SUPPORT));

    const [first, second] = await Promise.all([
      loadSimWidgetSupport(),
      loadSimWidgetSupport(),
    ]);

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(await loadSimWidgetSupport()).toBe(first);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});
