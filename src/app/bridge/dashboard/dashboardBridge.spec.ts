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
  readData: (key: string) => (key === 'currentProfile' ? 'race' : undefined),
  writeData: mocks.writeData,
}));
vi.mock('../../storage/driverTagSettings', () => ({
  getDriverTagSettings: () => undefined,
  saveDriverTagSettings: vi.fn(),
}));
vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { publishDashboardUpdates } from './dashboardBridge';

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
  mocks.readFile.mockResolvedValue(JSON.stringify(exportedDashboard));
});

beforeAll(async () => {
  await publishDashboardUpdates(
    {
      closeOrCreateWindows: vi.fn(),
      publishMessage: vi.fn(),
      forceRefreshOverlays: mocks.refresh,
      setSettingsTitleBarTheme: vi.fn(),
    } as unknown as OverlayManager,
    {} as Analytics
  );
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
