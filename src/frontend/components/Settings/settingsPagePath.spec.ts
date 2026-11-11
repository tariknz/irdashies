import { describe, expect, it } from 'vitest';
import { settingsPagePath } from './settingsPagePath';

describe('settingsPagePath', () => {
  it('drops a trailing slash, as the routes do', () => {
    expect(settingsPagePath('/settings/profiles/')).toBe('/settings/profiles');
    expect(settingsPagePath('/settings/standings//')).toBe(
      '/settings/standings'
    );
    expect(settingsPagePath('/settings/')).toBe('/settings');
  });

  it('leaves a path without one, and the root, as they are', () => {
    expect(settingsPagePath('/settings/profiles')).toBe('/settings/profiles');
    expect(settingsPagePath('/')).toBe('/');
  });
});
