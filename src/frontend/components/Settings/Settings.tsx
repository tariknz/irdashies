import { useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  DEFAULT_SETTINGS_THEME,
  SETTINGS_THEMES,
  type SettingsTheme,
} from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';

// Persisted config is untrusted: an unknown value falls back to the default
// instead of producing a class with no matching theme.
const resolveTheme = (value: unknown): SettingsTheme =>
  SETTINGS_THEMES.includes(value as SettingsTheme)
    ? (value as SettingsTheme)
    : DEFAULT_SETTINGS_THEME;

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
    ? resolveTheme(currentDashboard.generalSettings?.settingsTheme)
    : undefined;

  // Portaled popups (e.g. the profile Actions menu) render into <body>,
  // outside the wrapper below, so the theme goes on <body> too.
  const classes = theme ? themeClasses(theme) : [];
  const classNames = classes.join(' ');
  useEffect(() => {
    if (!classNames) return;
    const list = classNames.split(' ');
    document.body.classList.add(...list);
    return () => document.body.classList.remove(...list);
  }, [classNames]);

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  return (
    <div className={`${classNames} w-full h-full`}>
      <SettingsLayout />
    </div>
  );
};
