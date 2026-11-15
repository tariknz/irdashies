import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppMetrics: vi.fn(() => []) },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

import { app, BrowserWindow } from 'electron';
import type { Telemetry } from '@irdashies/types';
import {
  isSyntheticPerfSource,
  parsePerfSourceKind,
  resolvePerfSimulatorMode,
  sumCompletePrivateMemoryMB,
  TelemetryPerfMetrics,
} from './perfMetrics';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(app.getAppMetrics).mockReturnValue([]);
  vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);
});

describe('performance process memory coverage', () => {
  it('disables default collectors independently of the capture flag', () => {
    vi.stubEnv('PERF_METRICS', '1');
    vi.stubEnv('PERF_METRICS_COLLECTION', 'off');
    const metrics = new TelemetryPerfMetrics();
    expect(metrics.enabled).toBe(false);
    metrics.startReporting();
    metrics.tick({ FrameRate: { value: [60] } } as Telemetry);
    expect(vi.mocked(app.getAppMetrics)).not.toHaveBeenCalled();
    expect(new TelemetryPerfMetrics(true).enabled).toBe(true);
  });

  it('sums private bytes only when every included process reports them', () => {
    expect(sumCompletePrivateMemoryMB([1024, 2048])).toBe(3);
    expect(sumCompletePrivateMemoryMB([1024, undefined])).toBeUndefined();
    expect(sumCompletePrivateMemoryMB([])).toBeUndefined();
  });
});

describe('performance telemetry source metadata', () => {
  it('recognizes all source kinds and synthetic kinds', () => {
    expect(parsePerfSourceKind('mock')).toBe('mock');
    expect(parsePerfSourceKind('tape')).toBe('tape');
    expect(parsePerfSourceKind('sdk-replay')).toBe('sdk-replay');
    expect(parsePerfSourceKind('live')).toBe('live');
    expect(parsePerfSourceKind('other')).toBeUndefined();
    expect(isSyntheticPerfSource('mock')).toBe(true);
    expect(isSyntheticPerfSource('tape')).toBe(true);
    expect(isSyntheticPerfSource('sdk-replay')).toBe(true);
    expect(isSyntheticPerfSource('live')).toBe(false);
    expect(isSyntheticPerfSource(undefined)).toBe(false);
  });

  it('preserves requested replay mode for an SDK live source', () => {
    expect(resolvePerfSimulatorMode('live', 'replay')).toBe('replay');
    expect(resolvePerfSimulatorMode('live', undefined)).toBe('live');
    expect(resolvePerfSimulatorMode('sdk-replay', 'live')).toBe('replay');
    expect(resolvePerfSimulatorMode('mock', 'replay')).toBe('mock');
    expect(resolvePerfSimulatorMode(undefined, 'replay')).toBe('replay');
  });

  it('suppresses fixture telemetry stats for synthetic sources', () => {
    vi.stubEnv('PERF_SOURCE_KIND', 'sdk-replay');
    const metrics = new TelemetryPerfMetrics(true);
    metrics.tick({
      FrameRate: { value: [144] },
      CpuUsageFG: { value: [0.5] },
      CpuUsageBG: { value: [0.25] },
      GpuUsage: { value: [0.75] },
    } as Telemetry);

    const report = metrics.report();
    expect(report.iracing.frameRate.count).toBe(0);
    expect(report.iracing.cpuUsageForeground.count).toBe(0);
    expect(report.iracing.cpuUsageBackground.count).toBe(0);
    expect(report.iracing.gpuUsage.count).toBe(0);
    expect(report.scenarioMetadata).toMatchObject({
      sourceKind: 'sdk-replay',
      simulatorMode: 'replay',
    });
  });

  it('clears prior source stats when the source changes', () => {
    vi.stubEnv('PERF_SOURCE_KIND', 'live');
    const metrics = new TelemetryPerfMetrics(true);
    metrics.tick({ FrameRate: { value: [30] } } as Telemetry);
    vi.stubEnv('PERF_SOURCE_KIND', 'mock');
    metrics.tick({ FrameRate: { value: [90] } } as Telemetry);

    expect(metrics.report().iracing.frameRate).toMatchObject({
      count: 0,
      avg: 0,
    });
  });

  it('keeps legacy telemetry collection when source kind is absent', () => {
    vi.stubEnv('PERF_SOURCE_KIND', '');
    const metrics = new TelemetryPerfMetrics(true);
    metrics.tick({ FrameRate: { value: [60] } } as Telemetry);

    expect(metrics.report().iracing.frameRate).toMatchObject({
      count: 1,
      avg: 60,
    });
  });

  it('keeps requested replay mode in metadata for an SDK live source', () => {
    vi.stubEnv('PERF_SOURCE_KIND', 'live');
    vi.stubEnv('PERF_SCENARIO_METADATA', '{"simulatorMode":"replay"}');

    expect(
      new TelemetryPerfMetrics(true).report().scenarioMetadata
    ).toMatchObject({ sourceKind: 'live', simulatorMode: 'replay' });
  });

  it('includes per-process CPU deltas in reports after a valid baseline', () => {
    const metric = (cumulativeCPUUsage: number) =>
      ({
        pid: 123,
        creationTime: 456,
        type: 'Browser',
        name: 'browser',
        cpu: { cumulativeCPUUsage, percentCPUUsage: 0 },
        memory: { workingSetSize: 1024, privateBytes: 1024 },
      }) as Electron.ProcessMetric;
    vi.mocked(app.getAppMetrics)
      .mockReturnValueOnce([metric(1)])
      .mockReturnValueOnce([metric(1.25)]);
    const metrics = new TelemetryPerfMetrics(true);

    expect(metrics.report().processes?.[0]).toMatchObject({ pid: 123 });
    const processReport = metrics.report().processes?.[0];
    expect(processReport).toMatchObject({
      pid: 123,
      creationTime: 456,
      cpuTimeMs: 250,
    });
    expect(processReport?.cpuTimeMsPerSecond).toEqual(expect.any(Number));
    expect(processReport?.cpuSampleIntervalMs).toBeGreaterThan(0);
  });
});

describe('per-window channel attribution', () => {
  it('refreshes window, WebContents and OS process identity and preserves unavailable inventory', () => {
    const window = {
      id: 12,
      isDestroyed: () => false,
      isVisible: () => false,
      webContents: {
        id: 27,
        getOSProcessId: () => 1234,
        getURL: () => '#/overlay-widget',
      },
    };
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      window as unknown as Electron.BrowserWindow,
    ]);
    const metrics = new TelemetryPerfMetrics(true);
    expect(metrics.report().runtimeWindows).toEqual([
      {
        windowId: 12,
        webContentsId: 27,
        pid: 1234,
        route: '#/overlay-widget',
        visible: false,
      },
    ]);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);
    expect(metrics.report().runtimeWindows).toEqual([]);
    vi.mocked(BrowserWindow.getAllWindows).mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(metrics.report().runtimeWindows).toBeUndefined();
  });
  it('reports renderer/channel interval deltas separately from subscription rates', () => {
    let count = 3;
    const source = {
      metricsSnapshot: () => ({
        publications: { '7:track': count },
        deliveries: { '7:track': count - 1 },
        channelPublications: { track: count },
        channelDeliveries: { track: count - 1 },
      }),
      subscriptionSnapshot: () => [
        { rendererId: 7, channel: 'track', rateHz: 25, active: true },
      ],
    };
    const metrics = new TelemetryPerfMetrics(true, source);
    expect(metrics.report().channelMetrics).toMatchObject({
      rendererPublications: { '7:track': 3 },
      rendererDeliveries: { '7:track': 2 },
      subscriptions: [{ rendererId: 7, rateHz: 25 }],
    });
    count = 5;
    expect(metrics.report().channelMetrics).toMatchObject({
      rendererPublications: { '7:track': 2 },
      rendererDeliveries: { '7:track': 2 },
    });
    expect(metrics.report().channelMetrics?.rendererDeliveries).toEqual({
      '7:track': 0,
    });
  });
});
