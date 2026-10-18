import { useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import { resolveSettingsTheme } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';
import { themeClasses } from './settingsThemeClasses';

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
    // No native title bar: keep a drag handle clear of the window controls.
    return (
      <div className="h-10 pr-[124px] [-webkit-app-region:drag]">
        Loading...
      </div>
    );
  }

  return (
    <div className={`${themeClasses(theme).join(' ')} w-full h-full`}>
      <SettingsLayout />
    </div>
  );
};
