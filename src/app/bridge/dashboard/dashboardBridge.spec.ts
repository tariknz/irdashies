import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DriverTagSettings } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import type { Analytics } from '../../analytics';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  readFile: vi.fn(),
  writeData: vi.fn(),
  refresh: vi.fn(),
  publish: vi.fn(),
  closeOrCreate: vi.fn(),
  sendState: vi.fn(),
  getDriverTagSettings: vi.fn<() => DriverTagSettings | undefined>(),
  saveDriverTagSettings: vi.fn<(settings: DriverTagSettings) => void>(),
  dashboards: {} as Record<string, DashboardLayout>,
}));

vi.mock('electron', () => ({
  app: {},
  ipcMain: {
    handle: (channel: string, callback: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(channel, callback),
    on: (channel: string, callback: (...args: unknown[]) => unknown) =>
      mocks.listeners.set(channel, callback),
  },
  dialog: {
    showOpenDialog: async () => ({
      canceled: false,
      filePaths: ['/dashboard.json'],
    }),
  },
}));

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: mocks.readFile,
}));

vi.mock('../../storage/storage', () => ({
  readData: (key: string) =>
    key === 'currentProfile'
      ? 'race'
      : key === 'dashboards'
        ? mocks.dashboards
        : undefined,
  writeData: mocks.writeData,
}));
vi.mock('../../storage/driverTagSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../storage/driverTagSettings')>()),
  getDriverTagSettings: mocks.getDriverTagSettings,
  saveDriverTagSettings: mocks.saveDriverTagSettings,
}));
vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dashboardBridge, publishDashboardUpdates } from './dashboardBridge';
import { emitDashboardUpdated } from '../../storage/dashboardEvents';

const exportedDashboard: DashboardLayout = {
  widgets: [
    {
      id: 'standings',
      enabled: true,
      layout: { x: 20, y: 40, width: 400, height: 300 },
      config: { scale: 125 },
    },
  ],
};

beforeEach(() => {
  mocks.writeData.mockClear();
  mocks.refresh.mockClear();
  mocks.publish.mockClear();
  mocks.closeOrCreate.mockReset();
  mocks.sendState.mockClear();
  mocks.getDriverTagSettings.mockReset();
  mocks.saveDriverTagSettings.mockReset();
  mocks.dashboards = { race: { widgets: [] } };
  mocks.readFile.mockResolvedValue(JSON.stringify(exportedDashboard));
});

beforeAll(async () => {
  await publishDashboardUpdates(
    {
      closeOrCreateWindows: mocks.closeOrCreate,
      publishMessage: mocks.publish,
      publishProfileTransition: vi.fn(),
      sendOverlayState: mocks.sendState,
      forceRefreshOverlays: mocks.refresh,
    } as unknown as OverlayManager,
    {} as Analytics
  );
});

describe('driver tag settings', () => {
  const savedTags: DriverTagSettings = {
    groups: [{ id: 'team', name: 'Team', color: 0xff0000 }],
    entries: [{ id: '123', groupId: 'team', label: 'Captain' }],
    display: { enabled: true, displayStyle: 'tag' },
  };

  beforeEach(() => {
    mocks.dashboards.race = {
      widgets: [],
      generalSettings: { driverTagSettings: savedTags },
    };
  });

  it('includes tags from the active dashboard when adding the first global tag', async () => {
    const settings = (await mocks.handlers.get('getDriverTagSettings')?.()) as
      DriverTagSettings | undefined;
    expect(settings).toEqual(savedTags);
    if (!settings) throw new Error('Expected saved driver tags');

    const updated = {
      ...settings,
      entries: [...(settings.entries ?? []), { id: '456', groupId: 'team' }],
    };
    await mocks.handlers.get('saveDriverTagSettings')?.(null, updated);

    expect(mocks.saveDriverTagSettings).toHaveBeenCalledWith(updated);
    expect(mocks.publish).toHaveBeenCalledWith(
      'dashboardUpdated',
      expect.objectContaining({
        generalSettings: expect.objectContaining({
          driverTagSettings: updated,
        }),
      }),
      'race'
    );
  });

  it('keeps an explicitly empty global list ahead of an older dashboard copy', async () => {
    const globalTags = { ...savedTags, entries: [] };
    mocks.getDriverTagSettings.mockReturnValue(globalTags);

    expect(await mocks.handlers.get('getDriverTagSettings')?.()).toEqual(
      globalTags
    );
  });

  it('repairs malformed dashboard tag settings before returning them to the editor', async () => {
    mocks.dashboards.race.generalSettings = {
      driverTagSettings: {
        groups: [null, { ...savedTags.groups[0], icon: {} }, { id: 23 }],
        entries: {},
        display: {
          enabled: 'yes',
          displayStyle: 'tag',
          widthPx: '6',
          iconWeight: [],
          alternateFrequency: -1,
        },
        presetOverrides: {
          friend: { name: 'Teammate', color: 'yellow' },
          twitch: 0,
        },
      } as unknown as DriverTagSettings,
    };

    expect(await mocks.handlers.get('getDriverTagSettings')?.()).toEqual({
      groups: savedTags.groups,
      entries: [],
      display: { enabled: false, displayStyle: 'tag' },
      presetOverrides: { friend: { name: 'Teammate' } },
    });
  });
});

describe('dashboard save callbacks', () => {
  it('broadcasts the normalized dashboard persisted by storage', () => {
    mocks.writeData.mockImplementation((key, value) => {
      if (key === 'dashboards') {
        mocks.dashboards = value as Record<string, DashboardLayout>;
      }
    });
    const callback = vi.fn();
    const unsubscribe = dashboardBridge.dashboardUpdated(callback);

    dashboardBridge.saveDashboard(
      {
        widgets: [],
        generalSettings: { colorPalette: 'legacy' as never },
      },
      { profileId: 'race', saveId: 'settings:1' }
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        generalSettings: expect.objectContaining({ colorPalette: 'default' }),
      }),
      'race',
      'settings:1'
    );
    unsubscribe?.();
  });
});

describe('dashboard renderer initialization', () => {
  it('replies once per requesting renderer without broadcasting', () => {
    const senders = Array.from({ length: 6 }, () => ({
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    }));
    for (const sender of senders) {
      mocks.listeners.get('reloadDashboard')?.({ sender });
    }
    for (const sender of senders) {
      expect(sender.send).toHaveBeenCalledOnce();
      expect(sender.send).toHaveBeenCalledWith(
        'dashboardUpdated',
        expect.objectContaining({ widgets: expect.any(Array) }),
        'race'
      );
      expect(mocks.sendState).toHaveBeenCalledWith(sender);
    }
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('does not reply to a renderer destroyed while its windows are reconciled', () => {
    const sender = { isDestroyed: vi.fn(() => false), send: vi.fn() };
    mocks.closeOrCreate.mockImplementationOnce(() => {
      sender.isDestroyed.mockReturnValue(true);
    });
    mocks.listeners.get('reloadDashboard')?.({ sender });
    expect(sender.send).not.toHaveBeenCalled();
    expect(mocks.sendState).not.toHaveBeenCalled();
  });

  it('still broadcasts real dashboard changes', () => {
    const dashboard: DashboardLayout = { widgets: [] };
    emitDashboardUpdated(dashboard);
    expect(mocks.publish).toHaveBeenCalledWith(
      'dashboardUpdated',
      dashboard,
      'race',
      undefined
    );
  });

  it('carries the save ID through an Electron dashboard broadcast', () => {
    const dashboard = { widgets: [], generalSettings: { fontSize: 'lg' } };
    mocks.listeners.get('saveDashboard')?.(null, dashboard, {
      profileId: 'race',
      saveId: 'settings:2',
    });
    expect(mocks.publish).toHaveBeenCalledWith(
      'dashboardUpdated',
      expect.objectContaining(dashboard),
      'race',
      'settings:2'
    );
  });

  it('ignores a save intended for a profile that is no longer active', () => {
    mocks.listeners.get('saveDashboard')?.(
      null,
      { widgets: [] },
      { profileId: 'previous', forceReload: true }
    );
    expect(mocks.writeData).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('dashboard import scaling', () => {
  it.each([
    'null',
    '[]',
    '{}',
    'false',
    '123',
    '"text"',
    '{"widgets":null}',
    '{"widgets":{}}',
    '{"widgets":"wrong"}',
  ])(
    'rejects %s from file and pasted JSON before applying defaults',
    async (content) => {
      mocks.readFile.mockResolvedValue(content);
      expect(
        await mocks.handlers.get('importDashboardFromFile')?.()
      ).toBeNull();
      mocks.listeners.get('saveDashboard')?.(null, JSON.parse(content), {
        forceReload: true,
      });
      expect(mocks.writeData).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();
    }
  );

  it('migrates an older file export before returning it to the settings page', async () => {
    const imported = (await mocks.handlers.get(
      'importDashboardFromFile'
    )?.()) as DashboardLayout;
    expect(imported.widgets[0].scale).toBe(125);
    expect(imported.widgets[0].config).not.toHaveProperty('scale');
  });

  it('migrates pasted JSON before saving and refreshing the overlays', () => {
    mocks.listeners.get('saveDashboard')?.(null, exportedDashboard, {
      forceReload: true,
    });
    const [key, dashboards] = mocks.writeData.mock.lastCall as [
      string,
      Record<string, DashboardLayout>,
    ];
    expect(key).toBe('dashboards');
    expect(dashboards.race.widgets[0].scale).toBe(125);
    expect(dashboards.race.widgets[0].config).not.toHaveProperty('scale');
    expect(mocks.refresh).toHaveBeenCalledWith(dashboards.race);
  });
});
