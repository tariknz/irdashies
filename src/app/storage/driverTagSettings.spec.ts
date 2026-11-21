import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriverTagSettings } from '@irdashies/types';
import {
  getDriverTagSettings,
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

describe('driver tag storage', () => {
  beforeEach(async () => {
    userData = await fs.mkdtemp(join(tmpdir(), 'irdashies-driver-tags-'));
  });

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true });
  });

  it.each(['driver-tags.json', 'config.json'])(
    'keeps tags from %s when adding a driver',
    async (file) => {
      const storedTags = { ...savedTags, mapping: { '123': 'team' } };
      await fs.writeFile(
        join(userData, file),
        JSON.stringify(
          file === 'config.json'
            ? { driverTagSettings: storedTags }
            : storedTags
        )
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
    }
  );
});
