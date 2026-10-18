import { useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import { resolveSettingsTheme, type SettingsTheme } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';

// Classic is the unmodified base look, so it skips the shared .settings-theme
// overrides (fonts, square corners, uppercase headings).
export const themeClasses = (theme: SettingsTheme) =>
  theme === 'classic'
    ? ['settings-theme-classic']
    : ['settings-theme', `settings-theme-${theme}`];

export const Settings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  // Unknown until the dashboard loads; resolving undefined would flash the
  // default theme for users on another one.
  const theme = currentDashboard
    ? resolveSettingsTheme(currentDashboard.generalSettings?.settingsTheme)
    : undefined;

  // Portaled popups (e.g. the profile Actions menu) render into <body>,
  // outside the wrapper below, so the theme goes on <body> too.
  useEffect(() => {
    if (!theme) return;
    const classes = themeClasses(theme);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [theme]);

  if (!theme || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  return (
    <div className={`${themeClasses(theme).join(' ')} w-full h-full`}>
      <SettingsLayout />
    </div>
  );
};
