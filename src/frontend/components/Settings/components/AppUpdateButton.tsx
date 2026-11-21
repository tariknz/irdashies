import { useState } from 'react';
import {
  ArrowCircleDownIcon,
  ArrowsClockwiseIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';
import type { AppUpdateAction } from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { useAppUpdateStatus } from '../AppUpdateStatusContext';

export const AppUpdateButton = () => {
  const status = useAppUpdateStatus();
  const bridge = window.appUpdatesBridge;
  const [pending, setPending] = useState<AppUpdateAction | null>(null);
  const [failed, setFailed] = useState(false);

  if (!bridge || !status?.canUpdate) return null;

  const { phase, newerVersionAvailable } = status;
  const ready = phase === 'ready' || phase === 'restart-error';
  const progressMessage =
    phase === 'restarting' || pending === 'restart'
      ? 'Restarting irDashies…'
      : phase === 'downloading'
        ? 'Downloading update…'
        : pending === 'download' ||
            (phase === 'checking' && newerVersionAvailable)
          ? 'Checking for update…'
          : '';

  if (!newerVersionAvailable && !ready && !progressMessage) return null;

  const busy = !!progressMessage;
  const actionLabel = ready
    ? 'Restart app to install update'
    : 'Download update';
  const label = progressMessage || actionLabel;
  const feedback =
    failed || phase === 'error' || phase === 'restart-error'
      ? 'Update action failed. Try again.'
      : phase === 'no-update'
        ? 'Update is not available for this installation yet.'
        : '';
  const Icon = busy
    ? CircleNotchIcon
    : ready
      ? ArrowsClockwiseIcon
      : ArrowCircleDownIcon;

  const install = async () => {
    if (busy) return;
    const action = ready ? 'restart' : 'download';
    setPending(action);
    setFailed(false);
    try {
      await bridge.install(action);
    } catch (error) {
      logger.error('[Updates] Sidebar action failed', error);
      setFailed(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="ml-auto shrink-0">
      <button
        type="button"
        aria-label={label}
        title={feedback ? `${label} · ${feedback}` : label}
        aria-disabled={busy}
        onClick={() => void install()}
        className="relative grid size-10 cursor-pointer place-items-center rounded-md text-slate-300 transition-colors aria-disabled:cursor-progress aria-[disabled=false]:hover:bg-slate-700/50 aria-[disabled=false]:hover:text-white"
      >
        <Icon
          size={24}
          aria-hidden="true"
          className={
            busy
              ? 'text-accent-300 motion-safe:animate-spin'
              : ready
                ? 'text-accent-300'
                : undefined
          }
        />
        {!ready && !busy && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent-400 ring-2 ring-slate-950"
          />
        )}
      </button>
      <span role="status" className="sr-only">
        {progressMessage ||
          feedback ||
          (ready ? actionLabel : 'Update available')}
      </span>
    </div>
  );
};
