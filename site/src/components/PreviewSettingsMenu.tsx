import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsMenu } from '@irdashies/frontend/components/Settings/SettingsMenu';
import { ReleaseNotesStatusProvider } from '@irdashies/frontend/components/Settings/ReleaseNotes/ReleaseNotesStatusContext';
import { settingsPageKind } from '@irdashies/frontend/components/Settings/settingsPageKind';
import { EXCLUDED_WIDGETS } from '../utils/previewWidgets';

export function PreviewSettingsMenu() {
  const { pathname } = useLocation();
  const lastOverlay = useRef('/settings/standings');
  const lastBroadcast = useRef('/settings/broadcast');
  useEffect(() => {
    const kind = settingsPageKind(pathname);
    if (kind === 'overlay') lastOverlay.current = pathname;
    else if (kind === 'broadcast') lastBroadcast.current = pathname;
  }, [pathname]);

  return (
    <ReleaseNotesStatusProvider>
      <SettingsMenu
        previewMode
        excludedWidgetTypes={EXCLUDED_WIDGETS}
        returnTo={lastOverlay.current}
        broadcastTo={lastBroadcast.current}
      />
    </ReleaseNotesStatusProvider>
  );
}
