import { app, autoUpdater, dialog } from 'electron';
import path from 'node:path';
import type { AppUpdateStatus } from '../../types/appUpdates';
import logger from '../logger';
import { compareVersions, normalizeVersion } from '../releaseNotes/version';
import { openAppUpdatePreference } from '../storage/appUpdatePreference';

const UPDATE_INTERVAL = 10 * 60 * 1000;
const REPOSITORY = 'tariknz/irdashies';

const newerVersion = (version: string, otherVersion: string | null): string =>
  otherVersion && compareVersions(otherVersion, version) > 0
    ? otherVersion
    : version;

async function fetchLatestVersion(): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/releases/latest`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) throw new Error('Latest release unavailable');
  const release: unknown = await response.json();
  const version =
    release && typeof release === 'object' && 'tag_name' in release
      ? normalizeVersion(release.tag_name)
      : null;
  if (!version) throw new Error('Invalid latest release version');
  return version;
}

export async function createAppUpdates(
  publish: (status: AppUpdateStatus) => void
) {
  const currentVersion = app.getVersion();
  const preference = await openAppUpdatePreference(
    path.join(app.getPath('userData'), 'auto-update.json'),
    (preferenceSaveFailed) => update({ preferenceSaveFailed })
  );
  const status: AppUpdateStatus = {
    currentVersion,
    latestVersion: null,
    autoUpdate: preference.enabled,
    preferenceSaveFailed: false,
    canUpdate: false,
    newerVersionAvailable: false,
    checkingLatest: false,
    latestCheckFailed: false,
    phase: 'idle',
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let manual = false;
  let downloadedVersion: string | null = null;

  const snapshot = () => ({ ...status });
  const update = (next: Partial<AppUpdateStatus>) => {
    Object.assign(status, next);
    status.newerVersionAvailable =
      status.latestVersion !== null &&
      compareVersions(status.latestVersion, currentVersion) > 0;
    if (!stopped) publish(snapshot());
  };

  const finishCheck = () => {
    const wasManual = manual;
    manual = false;
    return wasManual;
  };

  const reportUpdaterError = (error: unknown) => {
    const wasManual = finishCheck();
    logger.warn('[Updates] Native updater failed', error);
    if (status.phase === 'restarting') update({ phase: 'restart-error' });
    else update({ phase: wasManual || !status.canUpdate ? 'error' : 'idle' });
  };

  const restart = () => {
    if (
      stopped ||
      (status.phase !== 'ready' && status.phase !== 'restart-error')
    )
      return;
    update({ phase: 'restarting' });
    try {
      autoUpdater.quitAndInstall();
    } catch (error) {
      update({ phase: 'restart-error' });
      logger.warn('[Updates] Could not restart to install the update', error);
    }
  };

  const checkNative = (isManual: boolean) => {
    if (
      stopped ||
      !status.canUpdate ||
      status.phase === 'checking' ||
      status.phase === 'downloading' ||
      status.phase === 'ready' ||
      status.phase === 'restart-error' ||
      status.phase === 'restarting'
    ) {
      return;
    }
    manual = isManual;
    update({ phase: 'checking' });
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      reportUpdaterError(error);
    }
  };

  const schedule = () => {
    clearInterval(timer);
    if (!stopped && status.canUpdate && status.autoUpdate) {
      timer = setInterval(() => checkNative(false), UPDATE_INTERVAL);
      if (!process.argv.includes('--squirrel-firstrun')) checkNative(false);
    }
  };

  if (
    app.isPackaged &&
    app.getName() === 'irdashies' &&
    (process.platform === 'win32' || process.platform === 'darwin')
  ) {
    const format = process.windowsStore ? '/msix' : '';
    autoUpdater.on('error', reportUpdaterError);
    autoUpdater.on('update-available', () => update({ phase: 'downloading' }));
    autoUpdater.on('update-not-available', () => {
      finishCheck();
      update({ phase: 'no-update' });
    });
    autoUpdater.on('update-downloaded', (_event, _notes, releaseName) => {
      const wasManual = finishCheck();
      downloadedVersion = normalizeVersion(releaseName);
      update({
        phase: 'ready',
        latestVersion: downloadedVersion
          ? newerVersion(downloadedVersion, status.latestVersion)
          : status.latestVersion,
      });
      if (stopped || wasManual || !status.autoUpdate) return;
      void dialog
        .showMessageBox({
          type: 'info',
          title: 'Application Update',
          message: 'An irDashies update is ready',
          detail: 'Restart irDashies to apply the update.',
          buttons: ['Restart', 'Later'],
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0 && status.autoUpdate) restart();
        })
        .catch((error: unknown) =>
          logger.warn('[Updates] Could not prompt for a restart', error)
        );
    });
    try {
      autoUpdater.setFeedURL({
        url: `https://update.electronjs.org/${REPOSITORY}/${process.platform}-${process.arch}${format}/${currentVersion}`,
        headers: { 'User-Agent': `irdashies/${currentVersion}` },
      });
      status.canUpdate = status.phase !== 'error';
    } catch (error) {
      logger.warn('[Updates] Could not configure the update feed', error);
    }
    schedule();
  }

  return {
    snapshot,
    checkLatest: async () => {
      if (status.checkingLatest || stopped) return;
      update({ checkingLatest: true, latestCheckFailed: false });
      try {
        const releaseVersion = await fetchLatestVersion();
        const latestVersion = newerVersion(releaseVersion, downloadedVersion);
        if (
          status.phase === 'no-update' &&
          status.latestVersion &&
          compareVersions(latestVersion, status.latestVersion) > 0
        ) {
          update({ latestVersion, checkingLatest: false, phase: 'idle' });
        } else {
          update({ latestVersion, checkingLatest: false });
        }
      } catch (error) {
        logger.warn('[Updates] Could not look up the latest release', error);
        update({ latestCheckFailed: true, checkingLatest: false });
      }
    },
    setAutoUpdate: (enabled: boolean) => {
      if (stopped || !status.canUpdate || enabled === status.autoUpdate) return;
      preference.save(enabled);
      update({ autoUpdate: enabled });
      schedule();
    },
    install: () => {
      if (status.phase === 'ready' || status.phase === 'restart-error')
        restart();
      else checkNative(true);
    },
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    flush: preference.flush,
  };
}
