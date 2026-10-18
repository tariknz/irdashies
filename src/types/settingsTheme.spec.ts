import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS_THEME,
  SETTINGS_THEMES,
  resolveSettingsTheme,
} from './dashboardLayout';

describe('resolveSettingsTheme', () => {
  it.each(SETTINGS_THEMES)('keeps the known theme %s', (theme) => {
    expect(resolveSettingsTheme(theme)).toBe(theme);
  });

  it.each([undefined, null, '', 'Carbon', 'toString', 42])(
    'falls back to the default for %j',
    (value) => {
      expect(resolveSettingsTheme(value)).toBe(DEFAULT_SETTINGS_THEME);
    }
  );
});
