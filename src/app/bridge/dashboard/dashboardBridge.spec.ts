import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
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
vi.mock('../../storage/driverTagSettings', () => ({
  getDriverTagSettings: () => undefined,
  saveDriverTagSettings: vi.fn(),
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
  mocks.dashboards = { race: { widgets: [] } };
  mocks.readFile.mockResolvedValue(JSON.stringify(exportedDashboard));
});

beforeAll(async () => {
  await publishDashboardUpdates(
    {
      closeOrCreateWindows: mocks.closeOrCreate,
      publishMessage: mocks.publish,
      sendOverlayState: mocks.sendState,
      forceRefreshOverlays: mocks.refresh,
    } as unknown as OverlayManager,
    {} as Analytics
  );
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
      { profileId: 'race' }
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        generalSettings: expect.objectContaining({ colorPalette: 'default' }),
      }),
      'race'
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
        expect.objectContaining({ widgets: expect.any(Array) })
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
    expect(mocks.publish).toHaveBeenCalledWith('dashboardUpdated', dashboard);
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
