import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as disk } from 'node:fs';
import * as io from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { DashboardLayout } from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  userData: '',
  readData: vi.fn(),
  writeData: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => mocks.userData },
}));
vi.mock('./storage', () => ({
  readData: mocks.readData,
  writeData: mocks.writeData,
}));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: mocks.warn, error: mocks.error },
}));
vi.mock('./dashboardEvents', () => ({
  emitDashboardUpdated: vi.fn(),
  emitDashboardsSaved: vi.fn(),
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    writeFile: vi.fn(original.writeFile),
    rename: vi.fn(original.rename),
    readFile: vi.fn(original.readFile),
    unlink: vi.fn(original.unlink),
  };
});

const png = (value: number) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, value]);
const iconName = (buffer: Uint8Array) =>
  `player-icon-${createHash('sha1').update(buffer).digest('hex').slice(0, 10)}.png`;
const dashboard = (fileName = ''): DashboardLayout => ({
  widgets: [
    {
      id: 'map',
      enabled: true,
      layout: { x: 0, y: 0, width: 300, height: 300 },
      config: { playerIcon: { enabled: false, fileName } },
    },
  ],
});

let storage: typeof import('./dashboards');
let assetsPath: string;
let cachedDashboards: Record<string, DashboardLayout>;
let currentProfile: string;

const persist = async () => {
  await disk.writeFile(
    join(mocks.userData, 'config.json'),
    JSON.stringify({ dashboards: cachedDashboards })
  );
};
const put = async (name: string, buffer = png(0)) => {
  const path = join(assetsPath, name);
  await disk.writeFile(path, buffer);
  return path;
};
const files = () => disk.readdir(assetsPath);

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  // Reset failure injection as well as calls between cases.
  vi.mocked(io.writeFile).mockImplementation(disk.writeFile);
  vi.mocked(io.rename).mockImplementation(disk.rename);
  vi.mocked(io.readFile).mockImplementation(disk.readFile);
  vi.mocked(io.unlink).mockImplementation(disk.unlink);
  mocks.userData = await disk.mkdtemp(join(tmpdir(), 'irdashies-icons-'));
  assetsPath = join(mocks.userData, 'frontend', 'assets', 'img');
  await disk.mkdir(assetsPath, { recursive: true });
  currentProfile = 'race';
  cachedDashboards = { default: dashboard(), race: dashboard() };
  mocks.readData.mockImplementation((key: string) => {
    if (key === 'dashboards') return cachedDashboards;
    if (key === 'currentProfile') return currentProfile;
    return undefined;
  });
  mocks.writeData.mockImplementation((key: string, value: unknown) => {
    if (key === 'dashboards') {
      cachedDashboards = value as Record<string, DashboardLayout>;
    }
  });
  await persist();
  storage = await import('./dashboards');
});

afterEach(async () => {
  await disk.rm(mocks.userData, { recursive: true, force: true });
});

describe('player icon upload retention', () => {
  it.each([
    ['jpg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])],
    ['gif', Uint8Array.from([0x47, 0x49, 0x46, 0x38])],
    ['webp', Uint8Array.from(Buffer.from('RIFF0000WEBP'))],
    [
      'svg',
      Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ],
  ])(
    'preserves normal %s upload detection and display',
    async (extension, buffer) => {
      const path = await storage.savePlayerIconImage(buffer);
      expect(path.endsWith(`.${extension}`)).toBe(true);
      expect(await disk.readFile(path)).toEqual(Buffer.from(buffer));
      expect(await storage.getPlayerIconImageAsDataUrl(path)).toContain(
        Buffer.from(buffer).toString('base64')
      );
    }
  );

  it('preserves two profiles while replacing the active non-default profile icon', async () => {
    const defaultIcon = await put(iconName(png(1)));
    const raceIcon = await put(iconName(png(2)));
    cachedDashboards = {
      default: dashboard(defaultIcon),
      race: dashboard(basename(raceIcon)),
    };
    await persist();

    const replacement = await storage.savePlayerIconImage(png(3));
    // The upload returns before the settings reference is persisted.
    expect(await files()).toEqual(
      expect.arrayContaining([
        basename(defaultIcon),
        basename(raceIcon),
        basename(replacement),
      ])
    );
    storage.saveDashboard(currentProfile, dashboard(basename(replacement)));
    await persist();
    const next = await storage.savePlayerIconImage(png(4));

    expect(await files()).toEqual(
      expect.arrayContaining([
        basename(defaultIcon),
        basename(replacement),
        basename(next),
      ])
    );
    expect(await files()).toContain(basename(raceIcon));
    expect(await storage.getPlayerIconImageAsDataUrl(defaultIcon)).toBeTruthy();
    expect(await storage.getPlayerIconImageAsDataUrl(replacement)).toBeTruthy();
  });

  it('preserves the disk reference when a settings write fails after cache mutation', async () => {
    const old = await put(iconName(png(1)));
    cachedDashboards.race = dashboard(basename(old));
    await persist();
    const replacement = await storage.savePlayerIconImage(png(2));
    mocks.writeData.mockImplementationOnce(() => {
      throw Object.assign(new Error('config write failed'), { code: 'ENOSPC' });
    });
    expect(() =>
      storage.saveDashboard('race', dashboard(basename(replacement)))
    ).toThrow('config write failed');
    expect(storage.getDashboard('race')).toMatchObject(
      dashboard(basename(replacement))
    );

    await storage.savePlayerIconImage(png(3));
    expect(await files()).toEqual(
      expect.arrayContaining([
        basename(old),
        basename(replacement),
        iconName(png(3)),
      ])
    );
  });

  it.each([false, true])(
    'preserves previous assets on a partial upload write failure (identical=%s)',
    async (identical) => {
      const old = await put(iconName(png(1)), png(1));
      const orphan = await put(iconName(png(9)), png(9));
      cachedDashboards.race = dashboard(basename(old));
      await persist();
      vi.mocked(io.writeFile).mockImplementationOnce(async (path) => {
        await disk.writeFile(path, 'partial');
        throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      });

      await expect(
        storage.savePlayerIconImage(png(identical ? 1 : 2))
      ).rejects.toMatchObject({ code: 'ENOSPC' });
      expect(await disk.readFile(old)).toEqual(Buffer.from(png(1)));
      expect(await files()).toEqual([basename(old), basename(orphan)].sort());
      // A failed operation must not prevent a later upload.
      expect(await storage.savePlayerIconImage(png(3))).toContain(
        iconName(png(3))
      );
    }
  );

  it('preserves the old image if atomic publication fails', async () => {
    const old = await put(iconName(png(1)), png(1));
    vi.mocked(io.rename).mockRejectedValueOnce(
      Object.assign(new Error('rename denied'), { code: 'EACCES' })
    );
    await expect(storage.savePlayerIconImage(png(1))).rejects.toMatchObject({
      code: 'EACCES',
    });
    expect(await disk.readFile(old)).toEqual(Buffer.from(png(1)));
    expect(await files()).toEqual([basename(old)]);
  });

  it('preserves concurrent uploads, including identical contents, across later saves', async () => {
    const paths = await Promise.all(
      [1, 2, 1, 3].map((n) => storage.savePlayerIconImage(png(n)))
    );
    storage.saveDashboard('default', dashboard());
    await persist();
    await storage.savePlayerIconImage(png(4));
    expect(await files()).toEqual(
      expect.arrayContaining(paths.map((path) => basename(path)))
    );
    expect(paths[0]).toBe(paths[2]);
    for (const [index, path] of paths.entries()) {
      expect(await disk.readFile(path)).toEqual(
        Buffer.from(png([1, 2, 1, 3][index]))
      );
    }
  });

  it('publishes identical concurrent uploads once rather than racing two renames', async () => {
    // Two renames replacing one file at once fail on Windows with EPERM.
    const [first, second] = await Promise.all([
      storage.savePlayerIconImage(png(1)),
      storage.savePlayerIconImage(png(1)),
    ]);
    expect(second).toBe(first);
    expect(vi.mocked(io.rename)).toHaveBeenCalledTimes(1);
    expect(await disk.readFile(first)).toEqual(Buffer.from(png(1)));
  });

  it('lets a later upload retry after a shared publication fails', async () => {
    vi.mocked(io.rename).mockRejectedValueOnce(
      Object.assign(new Error('rename denied'), { code: 'EPERM' })
    );
    const results = await Promise.allSettled([
      storage.savePlayerIconImage(png(1)),
      storage.savePlayerIconImage(png(1)),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(await storage.savePlayerIconImage(png(1))).toContain(
      iconName(png(1))
    );
  });

  it('retains saved and unused uploads across restart', async () => {
    const committed = await storage.savePlayerIconImage(png(1));
    const abandoned = await storage.savePlayerIconImage(png(2));
    cachedDashboards.race = dashboard(basename(committed));
    await persist();
    vi.resetModules();
    storage = await import('./dashboards');
    await storage.savePlayerIconImage(png(3));
    expect(await files()).toContain(basename(committed));
    expect(await files()).toContain(basename(abandoned));
  });

  it('retains a shared image after all profiles remove their icons', async () => {
    const shared = await put(iconName(png(1)));
    cachedDashboards = { default: dashboard(shared), race: dashboard(shared) };
    await persist();
    const replacement = await storage.savePlayerIconImage(png(2));
    storage.saveDashboard('race', dashboard(replacement));
    await persist();
    await storage.savePlayerIconImage(png(3));
    expect(await files()).toContain(basename(shared));
    storage.saveDashboard('default', dashboard());
    storage.saveDashboard('race', dashboard());
    await persist();
    await storage.savePlayerIconImage(png(4));
    expect(await files()).toContain(basename(shared));
  });

  it('retains legacy images when their last profile reference is removed', async () => {
    const legacy = await put('player-icon.png');
    const other = await put(iconName(png(2)));
    const unrelated = await put('player-icon-personal.png');
    cachedDashboards.race = dashboard(
      'C:\\old-user-data\\frontend\\assets\\img\\player-icon.png'
    );
    cachedDashboards.default = dashboard(basename(other));
    await persist();
    await storage.savePlayerIconImage(png(3));
    expect(await files()).toEqual(
      expect.arrayContaining([
        basename(legacy),
        basename(other),
        basename(unrelated),
      ])
    );

    storage.saveDashboard('race', dashboard());
    await persist();
    await storage.savePlayerIconImage(png(4));
    expect(await files()).toContain(basename(legacy));
    expect(await files()).toContain(basename(other));
    expect(await files()).toContain(basename(unrelated));
  });

  it.each(['missing', 'invalid JSON', 'invalid dashboards'])(
    'uploads without depending on %s saved config',
    async (kind) => {
      const old = await put(iconName(png(1)));
      if (kind === 'missing')
        await disk.unlink(join(mocks.userData, 'config.json'));
      else
        await disk.writeFile(
          join(mocks.userData, 'config.json'),
          kind === 'invalid JSON' ? '{' : '{"dashboards":{"race":null}}'
        );
      const replacement = await storage.savePlayerIconImage(png(2));
      expect(await files()).toEqual(
        expect.arrayContaining([basename(old), basename(replacement)])
      );
      expect(mocks.warn).not.toHaveBeenCalled();
    }
  );
});

describe('player icon reads', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['webp', 'image/webp'],
    ['svg', 'image/svg+xml'],
  ])(
    'returns a supported data URL for %s, including legacy absolute paths',
    async (extension, mime) => {
      const path = await put(`player-icon.${extension}`);
      expect(await storage.getPlayerIconImageAsDataUrl(path)).toBe(
        `data:${mime};base64,${Buffer.from(png(0)).toString('base64')}`
      );
    }
  );

  it('returns the existing null fallback and warns only once for a missing image', async () => {
    for (let n = 0; n < 3; n++) {
      expect(
        await storage.getPlayerIconImageAsDataUrl('player-icon-missing.png')
      ).toBeNull();
    }
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    const path = await put('player-icon-missing.png');
    expect(await storage.getPlayerIconImageAsDataUrl(path)).toBeTruthy();
    await disk.unlink(path);
    expect(await storage.getPlayerIconImageAsDataUrl(path)).toBeNull();
    expect(mocks.warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(mocks.userData);
  });

  it('bounds missing-file diagnostics for many distinct filenames', async () => {
    for (let n = 0; n < 110; n++) {
      await storage.getPlayerIconImageAsDataUrl(`missing-${n}.png`);
    }
    expect(mocks.warn).toHaveBeenCalledTimes(100);
  });

  it.each(['EACCES', 'EIO', undefined])(
    'keeps unexpected read failures diagnostic (code=%s)',
    async (code) => {
      vi.mocked(io.readFile).mockRejectedValueOnce(
        Object.assign(new Error(`read failed at ${mocks.userData}/icon.png`), {
          code,
        })
      );
      expect(
        await storage.getPlayerIconImageAsDataUrl('player-icon.png')
      ).toBeNull();
      expect(mocks.warn).toHaveBeenCalledWith(
        'Error reading player icon image:',
        'player-icon.png',
        expect.objectContaining({ code })
      );
      expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(
        mocks.userData
      );
    }
  );

  it('never reads outside the allowed image directory', async () => {
    await disk.writeFile(join(mocks.userData, 'secret.png'), png(1));
    expect(
      await storage.getPlayerIconImageAsDataUrl('../../../secret.png')
    ).toBeNull();
    expect(io.readFile).toHaveBeenCalledWith(join(assetsPath, 'secret.png'));
    vi.mocked(io.readFile).mockClear();
    expect(await storage.getPlayerIconImageAsDataUrl('..')).toBeNull();
    expect(io.readFile).not.toHaveBeenCalled();
  });
});
