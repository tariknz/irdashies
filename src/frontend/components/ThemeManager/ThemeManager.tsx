import { PropsWithChildren } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { useLocation } from 'react-router-dom';

export const ThemeManager = ({ children }: PropsWithChildren) => {
  const { fontSize, colorPalette,fontWeight } = useGeneralSettings() || {};
  const location = useLocation();

  // Don't apply theme changes to the settings page since
  // they share the same theme as the rest of the overlays
  if (location.pathname.startsWith('/settings')) {
    return <>{children}</>;
  }

  return (
    <div
      className={`
        relative w-full h-full overflow-hidden overlay-window 
        overlay-theme-${fontSize ?? 'sm'} 
        overlay-theme-color-${colorPalette ?? 'default'}
        overlay-theme-font-weight-${fontWeight ?? 'normal'}
      `}
    >
      {children}
    </div>
  );
};
