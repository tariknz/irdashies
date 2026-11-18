import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventMessage, IdentifyMessage } from 'posthog-node';
import type { DashboardLayout } from '@irdashies/types';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

const { userDataPath, store, measured } = vi.hoisted(() => ({
  userDataPath: { value: '' },
  store: { data: new Map<string, unknown>() },
  measured: {
    value: {} as Record<string, { s2StartPct: number; s3StartPct: number }>,
    loads: true,
  },
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

vi.mock('./storage/radarPoleSideOverrides', () => ({
  loadRadarPoleSideOverrides: async () => true,
  radarPoleSideOverrides: {
    snapshot: () => ({}),
    onChange: () => () => undefined,
  },
}));

vi.mock('./storage/lmuSectorBoundaryReportHash', () => ({
  readLmuSectorBoundaryReportHash: async () =>
    store.data.get('lmuSectorBoundaryReportHash'),
  writeLmuSectorBoundaryReportHash: async (hash: string) => {
    store.data.set('lmuSectorBoundaryReportHash', hash);
  },
}));

vi.mock('./storage/lmuSectorBoundaries', () => ({
  loadLmuSectorBoundaries: async () => measured.loads,
  lmuSectorBoundaryStore: { snapshot: () => measured.value },
}));

import { Analytics } from './analytics';
import { getAnalyticsOptOut } from './storage/analytics';

const HASH_KEY = 'lmuSectorBoundaryReportHash';
const LAGUNA = { s2StartPct: 0.3904, s3StartPct: 0.7925 };

const makeProvider = () => ({
  capture: vi.fn<(event: EventMessage) => void>(),
  captureConfirmed: vi
    .fn<(event: EventMessage) => Promise<void>>()
    .mockResolvedValue(undefined),
  identify: vi.fn<(message: IdentifyMessage) => void>(),
  shutdown: vi.fn<(shutdownTimeoutMs?: number) => void>(),
});

describe('Analytics LMU sector boundary report', () => {
  let provider: ReturnType<typeof makeProvider>;

  const start = async (version = '3.0.0') => {
    const analytics = new Analytics(provider);
    await analytics.init(version, {} as DashboardLayout);
    await analytics.waitForLmuSectorBoundaryUpload();
  };
  const reports = () =>
    provider.captureConfirmed.mock.calls
      .map(([event]) => event)
      .filter((event) => event.event === 'lmu_sector_boundaries');

  beforeEach(() => {
    userDataPath.value = mkdtempSync(path.join(os.tmpdir(), 'irdashies-'));
    store.data.clear();
    measured.value = {};
    measured.loads = true;
    provider = makeProvider();
    vi.mocked(getAnalyticsOptOut).mockReturnValue(false);
  });

  it('sends nothing for an installation that never measured a track', async () => {
    await start();
    expect(reports()).toEqual([]);
  });

  it('reports the measurements once, then remembers what was acknowledged', async () => {
    measured.value = { '1000123': LAGUNA };
    await start();

    expect(reports()).toHaveLength(1);
    expect(reports()[0]).toMatchObject({
      event: 'lmu_sector_boundaries',
      properties: {
        version: '3.0.0',
        track_count: 1,
        tracks: { '1000123': { s2_start_pct: 0.3904, s3_start_pct: 0.7925 } },
      },
    });
    expect(store.data.get(HASH_KEY)).toBe(reports()[0].properties?.data_hash);

    await start('3.1.0');
    expect(reports()).toHaveLength(1);
  });

  it('reports a changed measurement', async () => {
    measured.value = { '1000123': LAGUNA };
    await start();
    measured.value = { '1000123': { ...LAGUNA, s3StartPct: 0.8 } };
    await start();

    expect(reports()).toHaveLength(2);
  });

  it('does not record a hash when delivery fails, so it is retried', async () => {
    measured.value = { '1000123': LAGUNA };
    provider.captureConfirmed.mockRejectedValueOnce(new Error('down'));
    await expect(start()).resolves.toBeUndefined();
    expect(store.data.get(HASH_KEY)).toBeUndefined();

    await start();
    expect(store.data.get(HASH_KEY)).toBeDefined();
  });

  it('respects the analytics opt-out', async () => {
    measured.value = { '1000123': LAGUNA };
    vi.mocked(getAnalyticsOptOut).mockReturnValue(true);
    await start();
    expect(reports()).toEqual([]);
  });

  it('sends nothing when the measurements file could not be read', async () => {
    measured.value = { '1000123': LAGUNA };
    measured.loads = false;
    await start();
    expect(reports()).toEqual([]);
  });
});
