import { describe, expect, it } from 'vitest';
import { settingsPageKind } from './settingsPageKind';

describe('settingsPageKind', () => {
  it('tells app, tool and overlay pages apart', () => {
    expect(settingsPageKind('/settings/general')).toBe('app');
    expect(settingsPageKind('/settings/about')).toBe('app');
    expect(settingsPageKind('/settings/profiles')).toBe('tool');
    expect(settingsPageKind('/settings/driver-tags')).toBe('tool');
    expect(settingsPageKind('/settings/standings')).toBe('overlay');
    expect(settingsPageKind('/settings')).toBe('overlay');
  });
});
