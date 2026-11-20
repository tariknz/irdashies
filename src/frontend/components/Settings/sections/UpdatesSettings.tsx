import { useEffect, useState } from 'react';
import { ArrowClockwiseIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import type { AppUpdateStatus } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

const getUpdateMessage = (status: AppUpdateStatus): string => {
  if (!status.canUpdate) return 'This build does not support in-app updates.';
  switch (status.phase) {
    case 'checking':
      return 'Checking the update feed…';
    case 'downloading':
      return 'Downloading the update…';
    case 'ready':
      return 'The update is ready. Restart irDashies to apply it.';
    case 'restarting':
      return 'Restarting irDashies…';
    case 'no-update':
      if (status.newerVersionAvailable)
        return 'The latest release is not available for this installation yet.';
      break;
    case 'error':
      return 'Could not check for or download an update. Try again.';
    case 'restart-error':
      return 'Could not restart irDashies to install the update. Try again.';
  }
  if (status.newerVersionAvailable) return 'An update is available.';
  if (status.latestVersion && !status.latestCheckFailed)
    return 'You’re up to date.';
  return '';
};

export const UpdatesSettings = () => {
  const bridge = window.appUpdatesBridge;
  const [status, setStatus] = useState<AppUpdateStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => bridge?.onStatus(setStatus), [bridge]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      logger.error('[Updates] Settings action failed', error);
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const ready = status?.phase === 'ready' || status?.phase === 'restart-error';
  const updating =
    status?.phase === 'checking' ||
    status?.phase === 'downloading' ||
    status?.phase === 'restarting';
  const showInstall =
    status?.canUpdate &&
    (status.newerVersionAvailable ||
      status.latestCheckFailed ||
      updating ||
      ready);

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="mb-5 border-b border-slate-700 pb-5 pt-1 text-xl font-semibold tracking-tight text-white">
        Updates
      </h2>
      {bridge && status ? (
        <div className="flex flex-col gap-5">
          <dl className="grid max-w-lg grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-slate-300">Installed version</dt>
              <dd className="mt-1 font-semibold text-white">
                {status.currentVersion}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-300">Latest version</dt>
              <dd className="mt-1 font-semibold text-white">
                {status.latestVersion ??
                  (status.checkingLatest ? 'Checking…' : 'Unavailable')}
              </dd>
            </div>
          </dl>

          <div className="border-y border-slate-700/70 py-4">
            <label className="flex items-start gap-3 text-slate-200">
              <input
                type="checkbox"
                checked={status.canUpdate && status.autoUpdate}
                disabled={busy || !status.canUpdate}
                onChange={({ target: { checked } }) =>
                  void run(
                    () => bridge.setAutoUpdate(checked),
                    'Could not save the automatic update preference. Try again.'
                  )
                }
                className="mt-0.5 size-4 accent-accent-500"
                aria-describedby="automatic-updates-description"
              />
              <span>Automatic updates</span>
            </label>
            <p
              id="automatic-updates-description"
              className="ml-7 mt-1 text-sm text-slate-400"
            >
              Download updates in the background and prompt when they’re ready.
            </p>
            {status.preferenceSaveFailed && (
              <p role="alert" className="ml-7 mt-1 text-sm text-amber-200">
                Could not save this preference. It may reset the next time
                irDashies starts.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="settings-button"
                disabled={busy || status.checkingLatest}
                onClick={() =>
                  void run(
                    bridge.checkLatest,
                    'Could not check for updates. Try again.'
                  )
                }
              >
                <ArrowClockwiseIcon size={16} />
                {status.checkingLatest
                  ? 'Checking for updates…'
                  : 'Check for updates'}
              </button>
              {showInstall && (
                <button
                  type="button"
                  className="settings-button-primary"
                  disabled={busy || updating || status.checkingLatest}
                  onClick={() =>
                    void run(
                      bridge.install,
                      'Could not start the update. Try again.'
                    )
                  }
                >
                  {ready ? (
                    <ArrowClockwiseIcon size={16} />
                  ) : (
                    <DownloadSimpleIcon size={16} />
                  )}
                  {ready
                    ? 'Restart and install'
                    : status.newerVersionAvailable
                      ? 'Download update'
                      : 'Check and download'}
                </button>
              )}
            </div>
            <p role="status" className="text-sm text-slate-300">
              {getUpdateMessage(status)}
            </p>
            {(error || status.latestCheckFailed) && (
              <p role="alert" className="text-sm text-amber-200">
                {error ||
                  'Could not look up the latest version. Try checking again.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p role="status" className="text-slate-300">
          {bridge
            ? 'Loading update settings…'
            : 'Updates are available in the desktop app.'}
        </p>
      )}
    </div>
  );
};
