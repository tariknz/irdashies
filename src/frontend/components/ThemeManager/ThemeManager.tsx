import { PropsWithChildren } from 'react';
import { useGeneralSettings } from '@irdashies/context';

/**
 * Check if we're on the settings page by looking at the URL hash.
 * This works both with and without react-router context.
 */
const isSettingsPage = () => {
  return window.location.hash.startsWith('#/settings');
};

export const ThemeManager = ({ children }: PropsWithChildren) => {
  const { fontSize, colorPalette, fontFace, fontWeight } = useGeneralSettings() || {};

  // Don't apply theme changes to the settings page since
  // they share the same theme as the rest of the overlays
  if (isSettingsPage()) {
    return <>{children}</>;
  }

  return (
    <div
      className={`
        relative w-full h-full overflow-hidden overlay-window
        overlay-theme-${fontSize ?? 'sm'}
        overlay-theme-color-${colorPalette ?? 'default'}
        overlay-theme-font-face-${fontFace ?? 'lato'}
        overlay-theme-font-weight-${fontWeight ?? 'normal'}
      `}
    >
      {children}
    </div>
  );
};
