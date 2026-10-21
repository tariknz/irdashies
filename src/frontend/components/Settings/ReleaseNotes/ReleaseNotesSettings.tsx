import { useEffect, useState } from 'react';
import { releaseNotesFixture } from '@irdashies/types';
import { useReleaseNotesStatus } from './ReleaseNotesStatusContext';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { useReleaseNotes } from './useReleaseNotes';

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
  const [preview, setPreview] = useState(false);
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
    <div className="h-full overflow-y-auto">
      <h2 className="mb-4 text-xl font-bold">Release notes</h2>
      {error && (
        <p role="alert" className="mb-4 text-amber-200">
          Could not load or save release notes preferences.{' '}
          <button onClick={loadStatus} className="underline">
            Try again
          </button>
        </p>
      )}
      {status ? (
        <>
          <label className="mb-6 flex items-center gap-3 text-slate-300">
            <input
              type="checkbox"
              checked={status.autoShow}
              disabled={saving}
              onChange={(event) => void toggle(event.target.checked)}
              className="size-4 accent-accent-500"
            />
            Show release notes after updates
          </label>
          {status.simulation && (
            <p className="mb-4 text-amber-200">
              Local upgrade simulation. Release note preferences and dismissal
              are saved separately.
            </p>
          )}
          {status.availableVersion && (
            <label className="mb-4 flex items-center gap-3 text-slate-300">
              Version
              <select
                value={version ?? ''}
                onChange={(event) => setSelected(event.target.value)}
                className="rounded bg-slate-700 p-2"
              >
                <option value={status.currentVersion}>
                  Installed: {status.currentVersion}
                </option>
                <option value={status.availableVersion}>
                  Downloaded update: {status.availableVersion}
                </option>
              </select>
            </label>
          )}
          {version && (
            <ReleaseNotesPanel
              version={version}
              state={state}
              onRetry={retry}
            />
          )}
          {status.development && (
            <div className="mt-8 border-t border-slate-600 pt-4">
              <button
                onClick={() => setPreview(true)}
                className="rounded bg-slate-700 px-3 py-2 hover:bg-slate-600"
              >
                Preview update dialog
              </button>
              <p className="mt-2 text-xs text-slate-400">
                Development only. Uses sample notes and does not change
                dismissal state.
              </p>
            </div>
          )}
        </>
      ) : (
        !error && <p role="status">Loading release notes…</p>
      )}
      {preview && (
        <ReleaseNotesDialog
          preview
          version="2.1.0"
          state={{
            status: 'ready',
            release: releaseNotesFixture(),
            cached: false,
          }}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
};
