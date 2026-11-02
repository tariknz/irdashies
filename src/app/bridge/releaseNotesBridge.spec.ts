import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  packaged: false,
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => void>(),
  flush: vi.fn(async () => undefined),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return runtime.packaged;
    },
    getVersion: () => '2.0.0',
    getPath: () => path.join('test-user-data'),
  },
  autoUpdater: {
    on: (name: string, listener: (...args: unknown[]) => void) =>
      runtime.listeners.set(name, listener),
  },
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => unknown) =>
      runtime.handlers.set(name, handler),
  },
}));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));
vi.mock('../storage/releaseNotes', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../storage/releaseNotes')>();
  return {
    ...original,
    createReleaseNotesStore: vi.fn(() => {
      let state = original.defaultReleaseNotesState();
      return {
        load: async () => structuredClone(state),
        save: (next: typeof state) => {
          state = structuredClone(next);
        },
        flush: runtime.flush,
      };
    }),
  };
});

import { setupReleaseNotesBridge } from './releaseNotesBridge';
import { createReleaseNotesStore } from '../storage/releaseNotes';

function invoke(name: string, value?: unknown) {
  const handler = runtime.handlers.get(`releaseNotes:${name}`);
  if (!handler) throw new Error(`Missing ${name} handler`);
  return handler({}, value);
}

beforeEach(() => {
  vi.clearAllMocks();
  runtime.packaged = false;
  runtime.handlers.clear();
  runtime.listeners.clear();
  for (const name of ['CURRENT', 'PREVIOUS', 'STATE', 'LIVE']) {
    vi.stubEnv(`IRDASHIES_RELEASE_NOTES_${name}`, '');
  }
});
afterEach(() => vi.unstubAllEnvs());

describe('release notes runtime bridge', () => {
  it('ignores all development overrides in packaged builds', async () => {
    runtime.packaged = true;
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_CURRENT', '9.0.0');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_PREVIOUS', '8.0.0');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_STATE', 'override');
    const bridge = setupReleaseNotesBridge();
    await bridge.ready;
    await expect(invoke('status')).resolves.toMatchObject({
      currentVersion: '2.0.0',
      pendingVersion: null,
      unreadVersion: null,
      development: false,
      simulation: false,
    });
    expect(createReleaseNotesStore).toHaveBeenCalledWith(
      path.join('test-user-data', 'release-notes.json')
    );
    await bridge.flush();
    expect(runtime.flush).toHaveBeenCalledOnce();
  });

  it('uses isolated state and fixture notes for a local simulated upgrade', async () => {
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_CURRENT', '2.1.0');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_PREVIOUS', '2.0.0');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_STATE', 'upgrade-check');
    await setupReleaseNotesBridge().ready;
    expect(createReleaseNotesStore).toHaveBeenCalledWith(
      path.join('test-user-data', 'release-notes-preview-upgrade-check.json')
    );
    await expect(invoke('status')).resolves.toMatchObject({
      currentVersion: '2.1.0',
      pendingVersion: '2.1.0',
      unreadVersion: '2.1.0',
      simulation: true,
    });
    await expect(invoke('get', '2.1.0')).resolves.toMatchObject({
      status: 'ready',
      release: { version: '2.1.0' },
    });
    await invoke('dismiss', '2.1.0');
    await expect(invoke('status')).resolves.toMatchObject({
      pendingVersion: null,
      unreadVersion: null,
    });
  });

  it('contains malformed preview filenames within the user data directory', async () => {
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_CURRENT', '2.1.0');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_STATE', '../../other-location');
    await setupReleaseNotesBridge().ready;
    expect(createReleaseNotesStore).toHaveBeenCalledWith(
      path.join('test-user-data', 'release-notes-preview-preview.json')
    );
  });

  it('keeps malformed version overrides away from ordinary release-note state', async () => {
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_CURRENT', 'not-a-version');
    vi.stubEnv('IRDASHIES_RELEASE_NOTES_STATE', 'invalid-version');
    await setupReleaseNotesBridge().ready;
    expect(createReleaseNotesStore).toHaveBeenCalledWith(
      path.join('test-user-data', 'release-notes-preview-invalid-version.json')
    );
    await expect(invoke('status')).resolves.toMatchObject({
      currentVersion: '2.0.0',
      simulation: true,
    });
  });

  it('exposes downloaded version notes without invoking the updater', async () => {
    await setupReleaseNotesBridge().ready;
    const downloaded = runtime.listeners.get('update-downloaded');
    if (!downloaded) throw new Error('Missing download listener');
    downloaded({}, 'notes', 'v2.2.0');
    await expect(invoke('status')).resolves.toMatchObject({
      availableVersion: '2.2.0',
    });
    expect([...runtime.listeners.keys()]).toEqual(['update-downloaded']);
  });

  it('validates renderer arguments at the real service boundary', async () => {
    await setupReleaseNotesBridge().ready;
    await expect(invoke('get', '../../private')).rejects.toThrow();
    await expect(invoke('dismiss', '9.9.9')).rejects.toThrow();
    await expect(invoke('autoShow', 'true')).rejects.toThrow();
    await invoke('autoShow', false);
    await expect(invoke('status')).resolves.toMatchObject({ autoShow: false });
  });
});
