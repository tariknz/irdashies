import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsMenu } from '@irdashies/frontend/components/Settings/SettingsMenu';
import { ReleaseNotesStatusProvider } from '@irdashies/frontend/components/Settings/ReleaseNotes/ReleaseNotesStatusContext';
import { EXCLUDED_WIDGETS } from '../utils/previewWidgets';

export function PreviewSettingsMenu() {
  const { pathname } = useLocation();
  const lastOverlay = useRef('/settings/standings');
  useEffect(() => {
    if (pathname !== '/settings/general') lastOverlay.current = pathname;
  }, [pathname]);

  return (
    <ReleaseNotesStatusProvider>
      <SettingsMenu
        previewMode
        excludedWidgetTypes={EXCLUDED_WIDGETS}
        returnTo={lastOverlay.current}
      />
    </ReleaseNotesStatusProvider>
  );
}
