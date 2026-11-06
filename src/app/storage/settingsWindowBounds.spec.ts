import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSettingsWindowBoundsStore } from './settingsWindowBounds';
import { createBeforeQuitHandler } from '../shutdownCoordinator';
import logger from '../logger';

vi.mock('electron', () => ({ app: {} }));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));

const FILE = 'settings-window-bounds.json';
const chosen = { x: -1100, y: 60, width: 1400, height: 850 };
let directory: string;
let filePath: string;
let store: ReturnType<typeof createSettingsWindowBoundsStore>;
const failure = (code: string) => Object.assign(new Error(code), { code });
const read = async () => JSON.parse(await fsp.readFile(filePath, 'utf8'));

beforeEach(async () => {
  directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-settings-bounds-')
  );
  filePath = path.join(directory, FILE);
  store = createSettingsWindowBoundsStore(directory);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await store.flush();
  vi.useRealTimers();
  // directory is the exact mkdtemp result, never a real application profile.
  await fsp.rm(directory, { recursive: true, force: true });
});

describe('one-time settings bounds transition', () => {
  it('commits the marker on a fresh install without inventing saved bounds', async () => {
    await store.load();
    expect(store.get()).toBeUndefined();
    expect(await read()).toEqual({ defaultSizeApplied: true });
  });

  it.each([
    { x: 100, y: 20, width: 800, height: 700 },
    { x: -1800, y: -200, width: 1750, height: 1000 },
    null,
    'invalid',
    { width: 'broken' },
  ])(
    'invalidates any legacy rectangle %j and preserves unrelated data',
    async (legacy) => {
      const configPath = path.join(directory, 'config.json');
      const config = JSON.stringify({
        settingsWindowBounds: legacy,
        cycleProfiles: true,
        dashboards: { default: { widgets: ['sentinel'] } },
      });
      await fsp.writeFile(configPath, config);
      const profilePath = path.join(directory, 'profile-sentinel.json');
      await fsp.writeFile(profilePath, 'profile data');
      await store.load();
      expect(store.get()).toBeUndefined();
      expect(await read()).toEqual({ defaultSizeApplied: true });
      expect(await fsp.readFile(configPath, 'utf8')).toBe(config);
      expect(await fsp.readFile(profilePath, 'utf8')).toBe('profile data');
    }
  );

  it('preserves a later custom rectangle on the second and subsequent launches', async () => {
    await store.load();
    store.save(chosen);
    await store.flush();
    const second = createSettingsWindowBoundsStore(directory);
    await second.load();
    expect(second.get()).toEqual(chosen);
    const third = createSettingsWindowBoundsStore(directory);
    await third.load();
    expect(third.get()).toEqual(chosen);
  });

  it('coalesces repeated initialization and never resets a later resize', async () => {
    const write = vi.spyOn(fsp, 'writeFile');
    const first = store.load();
    expect(store.load()).toBe(first);
    await Promise.all([first, store.load()]);
    expect(write).toHaveBeenCalledOnce();
    store.save(chosen);
    await store.load();
    await store.flush();
    expect(store.get()).toEqual(chosen);
    expect(await read()).toEqual({ defaultSizeApplied: true, bounds: chosen });
  });

  it.each(['not json', 'null', '[]', '{}', '{"defaultSizeApplied":"true"}'])(
    'safely defaults malformed transition data: %s',
    async (raw) => {
      await fsp.writeFile(filePath, raw);
      await store.load();
      expect(store.get()).toBeUndefined();
      expect(await read()).toEqual({ defaultSizeApplied: true });
    }
  );

  it.each([null, [], 'bad', { x: 0, y: 0, width: -1, height: 10 }])(
    'discards malformed bounds after completion: %j',
    async (bounds) => {
      await fsp.writeFile(
        filePath,
        JSON.stringify({ defaultSizeApplied: true, bounds })
      );
      await store.load();
      expect(store.get()).toBeUndefined();
      store.save(chosen);
      await store.flush();
      expect((await read()).bounds).toEqual(chosen);
    }
  );
});

describe('persistence and interrupted migration', () => {
  it.each(['ENOSPC', 'EPERM'])(
    'does not report a durable marker on %s and retries next launch',
    async (code) => {
      const rename = vi.spyOn(fsp, 'rename').mockRejectedValue(failure(code));
      await store.load();
      expect(store.get()).toBeUndefined();
      await expect(fsp.readFile(filePath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(await fsp.readdir(directory)).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[SettingsWindowBounds] Failed to write',
        FILE,
        code
      );
      rename.mockRestore();
      const next = createSettingsWindowBoundsStore(directory);
      await next.load();
      expect(await read()).toEqual({ defaultSizeApplied: true });
    }
  );

  it('can atomically save a user resize after the initial migration write failed', async () => {
    const rename = vi
      .spyOn(fsp, 'rename')
      .mockRejectedValueOnce(failure('EPERM'));
    await store.load();
    store.save(chosen);
    await store.flush();
    expect(rename).toHaveBeenCalledTimes(2);
    const next = createSettingsWindowBoundsStore(directory);
    await next.load();
    expect(next.get()).toEqual(chosen);
  });

  it('retains the previous file on a partial write and retries on flush', async () => {
    await fsp.writeFile(filePath, '{}');
    const realWrite = fsp.writeFile.bind(fsp);
    vi.spyOn(fsp, 'writeFile').mockImplementationOnce(async (target) => {
      await realWrite(target, '{"partial":');
      throw failure('ENOSPC');
    });
    await store.load();
    expect(await read()).toEqual({});
    await store.flush();
    expect(await read()).toEqual({ defaultSizeApplied: true });
  });

  it('ignores a temp file left by termination before the atomic replacement', async () => {
    await fsp.writeFile(
      `${filePath}.interrupted.tmp`,
      '{"defaultSizeApplied":true'
    );
    await store.load();
    expect(store.get()).toBeUndefined();
    expect(await read()).toEqual({ defaultSizeApplied: true });
  });

  it('does not overwrite unreadable saved data; next launch restores it', async () => {
    const content = JSON.stringify({
      defaultSizeApplied: true,
      bounds: chosen,
    });
    await fsp.writeFile(filePath, content);
    const readFile = vi
      .spyOn(fsp, 'readFile')
      .mockRejectedValueOnce(failure('EACCES'));
    const write = vi.spyOn(fsp, 'writeFile');
    await store.load();
    expect(store.get()).toBeUndefined();
    store.save({ ...chosen, x: 10 });
    await store.flush();
    expect(write).not.toHaveBeenCalled();
    readFile.mockRestore();
    expect(await fsp.readFile(filePath, 'utf8')).toBe(content);
    const next = createSettingsWindowBoundsStore(directory);
    await next.load();
    expect(next.get()).toEqual(chosen);
  });

  it('debounces resizes and waits for the final rectangle during coordinated quit', async () => {
    await store.load();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const write = vi.spyOn(fsp, 'writeFile');
    store.save({ ...chosen, width: 1300 });
    store.save(chosen);
    vi.advanceTimersByTime(249);
    expect(write).not.toHaveBeenCalled();
    let finished!: () => void;
    const done = new Promise<void>((resolve) => {
      finished = resolve;
    });
    const quit = vi.fn(finished);
    const handler = createBeforeQuitHandler({
      prepareToQuit: vi.fn(),
      shutdown: () => store.flush(),
      quit,
      reportFailure: vi.fn(),
      timeoutMs: 5000,
    });
    handler({ preventDefault: vi.fn() });
    expect(quit).not.toHaveBeenCalled();
    await done;
    expect(write).toHaveBeenCalledOnce();
    expect((await read()).bounds).toEqual(chosen);
  });
});
