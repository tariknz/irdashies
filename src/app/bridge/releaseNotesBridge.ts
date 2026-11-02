import { app, autoUpdater, ipcMain } from 'electron';
import path from 'node:path';
import { releaseNotesFixture } from '../../types/releaseNotesFixture';
import { createReleaseNotesService } from '../releaseNotes/service';
import { normalizeVersion } from '../releaseNotes/version';
import { createReleaseNotesStore } from '../storage/releaseNotes';

export function setupReleaseNotesBridge() {
  // No preview switches are accepted by a distributed build. The isolated file
  // only contains release-note state; preview cannot touch production dismissal/cache.
  const development = !app.isPackaged;
  const previousVersion = development
    ? normalizeVersion(process.env.IRDASHIES_RELEASE_NOTES_PREVIOUS)
    : null;
  const overrideVersion = development
    ? normalizeVersion(process.env.IRDASHIES_RELEASE_NOTES_CURRENT)
    : null;
  const simulation =
    development &&
    !!(
      process.env.IRDASHIES_RELEASE_NOTES_PREVIOUS ||
      process.env.IRDASHIES_RELEASE_NOTES_CURRENT
    );
  const requestedKey = process.env.IRDASHIES_RELEASE_NOTES_STATE ?? 'preview';
  const key = /^[a-zA-Z0-9_-]{1,40}$/.test(requestedKey)
    ? requestedKey
    : 'preview';
  const store = createReleaseNotesStore(
    path.join(
      app.getPath('userData'),
      simulation ? `release-notes-preview-${key}.json` : 'release-notes.json'
    )
  );
  const service = createReleaseNotesService({
    store,
    development,
    simulation,
    currentVersion: overrideVersion ?? app.getVersion(),
    previousVersion: previousVersion ?? undefined,
    fixture:
      simulation && process.env.IRDASHIES_RELEASE_NOTES_LIVE !== '1'
        ? releaseNotesFixture
        : undefined,
  });
  // Electron only supplies the target name after download, not update-available.
  // Keep the existing updater and its native install prompt unchanged.
  const onDownloaded = (
    _event: unknown,
    _notes: string,
    releaseName: string
  ) => {
    service.setAvailableVersion(releaseName);
  };
  autoUpdater.on('update-downloaded', onDownloaded);
  ipcMain.handle('releaseNotes:status', () => service.getStatus());
  ipcMain.handle('releaseNotes:get', (_event, version: unknown) =>
    service.getRelease(version)
  );
  ipcMain.handle('releaseNotes:dismiss', (_event, version: unknown) =>
    service.dismiss(version)
  );
  ipcMain.handle('releaseNotes:autoShow', (_event, enabled: unknown) =>
    service.setAutoShow(enabled)
  );
  return {
    flush: async () => {
      await service.ready;
      await store.flush();
    },
    ready: service.ready,
  };
}
