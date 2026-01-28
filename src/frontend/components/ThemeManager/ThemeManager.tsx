import { PropsWithChildren } from 'react';
import { useGeneralSettings, useDashboard } from '@irdashies/context';
import { useLocation } from 'react-router-dom';

export const ThemeManager = ({ children }: PropsWithChildren) => {
  const generalSettings = useGeneralSettings();
  const { currentProfile } = useDashboard();
  const { fontSize, colorPalette,fontWeight } = useGeneralSettings() || {};
  const location = useLocation();

  // Profile theme settings override dashboard general settings
  const fontSize = currentProfile?.themeSettings?.fontSize ?? generalSettings?.fontSize ?? 'sm';
  const colorPalette = currentProfile?.themeSettings?.colorPalette ?? generalSettings?.colorPalette ?? 'default';

  // Don't apply theme changes to the settings page since
  // they share the same theme as the rest of the overlays
  if (location.pathname.startsWith('/settings')) {
    return <>{children}</>;
  }

  return (
    <div
      className={`
        relative w-full h-full overflow-hidden overlay-window 
        overlay-theme-${fontSize} 
        overlay-theme-color-${colorPalette}
        overlay-theme-${fontSize ?? 'sm'} 
        overlay-theme-color-${colorPalette ?? 'default'}
        overlay-theme-font-weight-${fontWeight ?? 'normal'}
      `}
    >
      {children}
    </div>
  );
};
