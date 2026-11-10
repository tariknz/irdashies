import { t } from '@irdashies/frontend/i18n';
import { useEffect, useState } from 'react';
import { useReleaseNotesStatus } from './ReleaseNotesStatusContext';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { useReleaseNotes } from './useReleaseNotes';
import { ReleaseNotesVersions } from './ReleaseNotesVersions';

export const ReleaseNotesSettings = () => {
  const {
    status,
    error,
    refresh: loadStatus,
    dismiss,
    setAutoShow,
  } = useReleaseNotesStatus();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const version = selected ?? status?.currentVersion ?? null;
  const { state, retry } = useReleaseNotes(version);
  const loadedVersion = state.status === 'ready' ? state.release.version : null;
  useEffect(() => {
    if (
      loadedVersion === version &&
      status &&
      version === status.currentVersion &&
      status.unreadVersion === version
    ) {
      void dismiss(version);
    }
  }, [loadedVersion, version, status, dismiss]);
  const toggle = async (enabled: boolean) => {
    setSaving(true);
    await setAutoShow(enabled);
    setSaving(false);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-5 shrink-0 border-b border-slate-700 pb-5 pt-1 text-xl font-semibold tracking-tight text-white">
        {t('Release notes')}
      </h2>
      {error && (
        <p role="alert" className="mb-4 text-amber-200">
          {t('Could not load or save release notes preferences.')}{' '}
          <button onClick={loadStatus} className="underline">
            {t('Try again')}
          </button>
        </p>
      )}
      {status ? (
        <>
          <label className="mb-6 flex shrink-0 items-center gap-3 text-slate-300">
            <input
              type="checkbox"
              checked={status.autoShow}
              disabled={saving}
              onChange={(event) => void toggle(event.target.checked)}
              className="size-4 accent-accent-500"
            />
            {t('Show release notes after updates')}
          </label>
          {status.simulation && (
            <p className="mb-4 text-amber-200">
              {t(
                'Local upgrade simulation. Release note preferences and dismissal are saved separately.'
              )}
            </p>
          )}
          {version && (
            <div className="flex min-h-0 flex-1 gap-4 sm:gap-6">
              <ReleaseNotesVersions
                currentVersion={status.currentVersion}
                availableVersion={status.availableVersion}
                selectedVersion={version}
                onSelect={setSelected}
              />
              <div
                key={version}
                className="min-w-0 flex-1 overflow-y-auto pr-1"
                role="region"
                aria-label={t('Release notes for v{version}', { version })}
              >
                <ReleaseNotesPanel
                  version={version}
                  state={state}
                  onRetry={retry}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        !error && <p role="status">{t('Loading release notes…')}</p>
      )}
    </div>
  );
};
