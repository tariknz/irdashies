import type { SettingsTheme } from '@irdashies/types';

// Classic keeps the stock palette and plain headings, so it skips the shared
// .settings-theme overrides (fonts, square corners, uppercase headings).
export const themeClasses = (theme: SettingsTheme) =>
  theme === 'classic'
    ? ['settings-theme-classic']
    : ['settings-theme', `settings-theme-${theme}`];
