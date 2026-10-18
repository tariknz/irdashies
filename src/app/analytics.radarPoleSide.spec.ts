import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventMessage, IdentifyMessage } from 'posthog-node';
import type { DashboardLayout } from '@irdashies/types';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

const { userDataPath, store } = vi.hoisted(() => ({
  userDataPath: { value: '' },
  store: { data: new Map<string, unknown>() },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataPath.value) },
  screen: {
    getAllDisplays: vi.fn().mockReturnValue([]),
    getPrimaryDisplay: vi
      .fn()
      .mockReturnValue({ size: { width: 0, height: 0 } }),
  },
}));

vi.mock('electron-log/main', () => ({
  default: {
    transports: { file: {}, console: {} },
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./storage/storage', () => ({
  readData: vi.fn((key: string) => store.data.get(key)),
  writeData: vi.fn((key: string, value: unknown) => store.data.set(key, value)),
}));

vi.mock('./storage/analytics', () => ({
  getAnalyticsOptOut: vi.fn().mockReturnValue(false),
}));

const { corrections } = vi.hoisted(() => ({
  corrections: { value: {} as Record<string, unknown> },
}));
vi.mock('./storage/radarPoleSideOverrides', () => ({
  radarPoleSideOverrides: { snapshot: () => corrections.value },
}));

import { Analytics } from './analytics';
import { getAnalyticsOptOut } from './storage/analytics';

const HASH_KEY = 'radarPoleSideReportHash';

const makeProvider = () => ({
  capture: vi.fn<(event: EventMessage) => void>(),
  captureConfirmed: vi
    .fn<(event: EventMessage) => Promise<void>>()
    .mockResolvedValue(undefined),
  identify: vi.fn<(message: IdentifyMessage) => void>(),
  shutdown: vi.fn<(shutdownTimeoutMs?: number) => void>(),
});

describe('Analytics radar pole side report', () => {
  let provider: ReturnType<typeof makeProvider>;

  const start = async (version = '2.0.0') => {
    const analytics = new Analytics(provider);
    await analytics.init(version, {} as DashboardLayout);
    await analytics.waitForRadarPoleSideUpload();
  };
  const reports = () =>
    provider.captureConfirmed.mock.calls
      .map(([event]) => event)
      .filter((event) => event.event === 'radar_pole_side');

  beforeEach(() => {
    userDataPath.value = mkdtempSync(path.join(os.tmpdir(), 'irdashies-'));
    store.data.clear();
    corrections.value = {};
    provider = makeProvider();
    vi.mocked(getAnalyticsOptOut).mockReturnValue(false);
  });

  it('sends nothing for an installation that never corrected a side', async () => {
    await start();
    expect(reports()).toEqual([]);
  });

  it('reports the corrections once, then remembers what was acknowledged', async () => {
    corrections.value = { '95': { start: false, table: true } };
    await start();

    expect(reports()).toHaveLength(1);
    expect(reports()[0]).toMatchObject({
      event: 'radar_pole_side',
      properties: {
        version: '2.0.0',
        track_count: 1,
        tracks: { '95': { start_left: false, table_left: true } },
      },
    });
    expect(store.data.get(HASH_KEY)).toBe(reports()[0].properties?.data_hash);

    await start('3.0.0');
    expect(reports()).toHaveLength(1);
  });

  it('reports a change, and a revert to nothing', async () => {
    corrections.value = { '95': { start: false, table: true } };
    await start();
    corrections.value = {
      '95': { start: false, restart: false, table: true },
    };
    await start();
    corrections.value = {};
    await start();

    expect(reports()).toHaveLength(3);
    expect(reports()[2].properties?.track_count).toBe(0);
  });

  it('does not record a hash when delivery fails, so it is retried', async () => {
    corrections.value = { '95': { start: false, table: true } };
    provider.captureConfirmed.mockRejectedValueOnce(new Error('down'));
    await expect(start()).resolves.toBeUndefined();
    expect(store.data.get(HASH_KEY)).toBeUndefined();

    await start();
    expect(store.data.get(HASH_KEY)).toBeDefined();
  });

  it('respects the analytics opt-out', async () => {
    corrections.value = { '95': { start: false, table: true } };
    vi.mocked(getAnalyticsOptOut).mockReturnValue(true);
    await start();
    expect(reports()).toEqual([]);
  });

  it('ignores a stored value that is not a hash', async () => {
    store.data.set(HASH_KEY, 'not-a-hash');
    await start();
    expect(reports()).toEqual([]);
  });
});
