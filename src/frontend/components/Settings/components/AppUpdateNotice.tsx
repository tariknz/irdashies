import { useState } from 'react';
import { ArrowCircleDownIcon } from '@phosphor-icons/react';
import logger from '@irdashies/utils/logger';
import { useAppUpdateStatus } from '../AppUpdateStatusContext';

const DISMISSED_KEY = 'appUpdateNoticeDismissed';

export const AppUpdateNotice = () => {
  const status = useAppUpdateStatus();
  const bridge = window.appUpdatesBridge;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!bridge || !status?.restartNotice || dismissed) return null;
  if (status.phase !== 'ready' && status.phase !== 'restart-error') return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, 'true');
    } catch (error) {
      logger.warn('[Updates] Could not save notice dismissal', error);
    }
  };

  const restart = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await bridge.install('restart');
    } catch (error) {
      logger.error('[Updates] Restart from notice failed', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      aria-label="Application update"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-settings-boundary bg-slate-800 px-4 py-2.5"
    >
      <div className="flex items-center gap-3" role="status">
        <ArrowCircleDownIcon
          size={24}
          aria-hidden="true"
          className="shrink-0 text-accent-300"
        />
        <div>
          <p className="text-sm font-semibold text-white">
            An irDashies update is ready
          </p>
          <p className="text-xs text-slate-300">
            {failed || status.phase === 'restart-error'
              ? 'Could not restart irDashies. Try again.'
              : 'Restart irDashies to apply the update.'}
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="settings-button"
          disabled={busy}
          onClick={dismiss}
        >
          Later
        </button>
        <button
          type="button"
          className="settings-button-primary"
          disabled={busy}
          onClick={() => void restart()}
        >
          {busy ? 'Restarting…' : 'Restart'}
        </button>
      </div>
    </aside>
  );
};
