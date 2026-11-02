import { useEffect, useState } from 'react';
import { useReleaseNotesStatus } from './ReleaseNotesStatusContext';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { useReleaseNotes } from './useReleaseNotes';

/** Mounted only by SettingsLayout. Overlays never request or show this dialog. */
export const ReleaseNotesAnnouncement = () => {
  const [version, setVersion] = useState<string | null>(null);
  const { state, retry } = useReleaseNotes(version);
  const { status, visibleSession, dismiss } = useReleaseNotesStatus();
  const pending = status?.pendingVersion;
  const autoShow = status?.autoShow;
  useEffect(() => {
    setVersion(autoShow ? (pending ?? null) : null);
  }, [pending, autoShow, visibleSession]);
  const close = () => {
    if (!version) return;
    // Failed loads are not acknowledged: reopening Settings can try again.
    if (state.status === 'ready') {
      void dismiss(version);
    }
    setVersion(null);
  };
  return version ? (
    <ReleaseNotesDialog
      version={version}
      state={state}
      onRetry={retry}
      onClose={close}
    />
  ) : null;
};
