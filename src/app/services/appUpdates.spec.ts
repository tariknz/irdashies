import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    getName: vi.fn(),
    getPath: vi.fn(),
    getVersion: () => '3.0.0',
  },
  dialog: { showMessageBox: vi.fn() },
  updater: {
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn(),
  },
}));

const updater = Object.assign(new EventEmitter(), electron.updater);

vi.mock('electron', () => ({
  app: electron.app,
  autoUpdater: updater,
  dialog: electron.dialog,
}));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));

const { createAppUpdates } = await import('./appUpdates');

describe('app updates', () => {
  const platform = process.platform;
  let dir: string;
  let updates: Awaited<ReturnType<typeof createAppUpdates>> | undefined;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    dir = await mkdtemp(path.join(os.tmpdir(), 'irdashies-updates-'));
    Object.defineProperty(process, 'platform', { value: 'win32' });
    electron.app.getName.mockReturnValue('irdashies');
    electron.app.getPath.mockReturnValue(dir);
    electron.dialog.showMessageBox.mockResolvedValue({ response: 1 });
  });

  afterEach(async () => {
    updates?.stop();
    await updates?.flush();
    updates = undefined;
    updater.removeAllListeners();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(process, 'platform', { value: platform });
    await rm(dir, { recursive: true, force: true });
  });

  it('honors a saved opt-out and looks up the latest version without downloading', async () => {
    await writeFile(path.join(dir, 'auto-update.json'), 'false');
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ tag_name: 'v3.1.2' }));
    vi.stubGlobal('fetch', fetch);
    updates = await createAppUpdates(vi.fn());
    await updates.checkLatest();
    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(updates.snapshot()).toMatchObject({
      autoUpdate: false,
      canUpdate: true,
      currentVersion: '3.0.0',
      latestVersion: '3.1.2',
      newerVersionAvailable: true,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('stops scheduled checks immediately and persists the new preference', async () => {
    updates = await createAppUpdates(vi.fn());
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    updater.emit('update-not-available');
    updates.setAutoUpdate(false);
    vi.advanceTimersByTime(10 * 60 * 1000);
    await updates.flush();

    expect(updates.snapshot().autoUpdate).toBe(false);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(await readFile(path.join(dir, 'auto-update.json'), 'utf8')).toBe(
      'false'
    );
  });

  it('allows one manual download at a time and restarts only when requested', async () => {
    await writeFile(path.join(dir, 'auto-update.json'), 'false');
    updates = await createAppUpdates(vi.fn());

    updates.install();
    updates.install();
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    updater.emit('update-available');
    expect(updates.snapshot().phase).toBe('downloading');
    updater.emit('update-downloaded', {}, '', '3.1.2');
    expect(updates.snapshot()).toMatchObject({
      phase: 'ready',
      latestVersion: '3.1.2',
    });
    expect(electron.dialog.showMessageBox).not.toHaveBeenCalled();

    updates.install();
    updates.install();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
    expect(updates.snapshot().phase).toBe('restarting');
  });

  it('suppresses the background restart prompt when automatic updates are turned off during a download', async () => {
    updates = await createAppUpdates(vi.fn());
    updater.emit('update-available');
    updates.setAutoUpdate(false);
    updater.emit('update-downloaded', {}, '', '3.1.2');

    expect(electron.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(updates.snapshot().phase).toBe('ready');
  });

  it('starts checking again when automatic updates are enabled', async () => {
    await writeFile(path.join(dir, 'auto-update.json'), 'false');
    updates = await createAppUpdates(vi.fn());

    updates.setAutoUpdate(true);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    updater.emit('update-not-available');
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
    updater.emit('update-downloaded', {}, '', '3.1.2');
    expect(electron.dialog.showMessageBox).toHaveBeenCalledOnce();
  });

  it('keeps the last known version visible when the release lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ tag_name: 'v3.1.2' }))
        .mockRejectedValueOnce(new Error('Offline'))
    );
    updates = await createAppUpdates(vi.fn());
    await updates.checkLatest();
    await updates.checkLatest();

    expect(updates.snapshot()).toMatchObject({
      checkingLatest: false,
      latestVersion: '3.1.2',
      latestCheckFailed: true,
    });
  });

  it('keeps side-by-side builds off the production update feed', async () => {
    electron.app.getName.mockReturnValue('irdashies-beta');
    updates = await createAppUpdates(vi.fn());
    updates.install();

    expect(updates.snapshot().canUpdate).toBe(false);
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});
