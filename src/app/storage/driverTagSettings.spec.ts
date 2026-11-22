import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriverTagSettings } from '@irdashies/types';
import {
  getDriverTagSettings,
  normalizeDriverTagSettings,
  saveDriverTagSettings,
} from './driverTagSettings';

let userData: string;
vi.mock('electron', () => ({ app: { getPath: () => userData } }));

const savedTags: DriverTagSettings = {
  groups: [{ id: 'team', name: 'Team', color: 0xff0000 }],
  entries: [
    { name: 'Morgan Lee', groupId: 'friend', label: 'Captain' },
    { id: '789', groupId: 'friend' },
  ],
  display: { enabled: true, displayStyle: 'tag' },
};

it.each([
  [1, undefined],
  [2, 2],
  [60, 60],
  [61, undefined],
  [Number.MAX_VALUE, undefined],
])(
  'normalizes a saved alternation frequency of %s to %s',
  (frequency, expected) => {
    const settings = normalizeDriverTagSettings({
      ...savedTags,
      display: { ...savedTags.display, alternateFrequency: frequency },
    });

    expect(settings).toEqual({
      ...savedTags,
      display: { ...savedTags.display, alternateFrequency: expected },
    });
  }
);

describe('driver tag storage', () => {
  beforeEach(async () => {
    userData = await fs.mkdtemp(join(tmpdir(), 'irdashies-driver-tags-'));
  });

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true });
  });

  it('keeps tags from driver-tags.json when adding a driver', async () => {
    const storedTags = { ...savedTags, mapping: { '123': 'team' } };
    await fs.writeFile(
      join(userData, 'driver-tags.json'),
      JSON.stringify(storedTags)
    );

    const settings = getDriverTagSettings();
    expect(settings).toEqual(savedTags);
    if (!settings) throw new Error('Expected saved driver tags');

    const updated = {
      ...settings,
      entries: [...(settings.entries ?? []), { id: '456', groupId: 'team' }],
    };
    saveDriverTagSettings(updated);
    expect(getDriverTagSettings()).toEqual(updated);
  });

  it('ignores top-level driver tags in config.json', async () => {
    await fs.writeFile(
      join(userData, 'config.json'),
      JSON.stringify({ driverTagSettings: savedTags })
    );

    expect(getDriverTagSettings()).toBeUndefined();
  });
});
