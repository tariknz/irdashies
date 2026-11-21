import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppMetrics: vi.fn(() => []) },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));
vi.mock('./processPrivateMemory', () => ({
  readProcessPrivateMemoryKB: vi.fn(async () => undefined),
}));

import { app } from 'electron';
import {
  sumCompletePrivateMemoryMB,
  TelemetryPerfMetrics,
} from './perfMetrics';
import { readProcessPrivateMemoryKB } from './processPrivateMemory';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(app.getAppMetrics).mockReturnValue([]);
  vi.mocked(readProcessPrivateMemoryKB).mockResolvedValue(undefined);
});

describe('performance process memory coverage', () => {
  it('sums private bytes only when every included process reports them', () => {
    expect(sumCompletePrivateMemoryMB([1024, 2048])).toBe(3);
    expect(sumCompletePrivateMemoryMB([1024, undefined])).toBeUndefined();
    expect(sumCompletePrivateMemoryMB([])).toBeUndefined();
  });
});

describe('performance run provenance metadata', () => {
  it('uses sampled /proc private memory when Electron omits privateBytes', async () => {
    vi.mocked(app.getAppMetrics).mockReturnValue([
      {
        pid: 1234,
        type: 'Browser',
        cpu: { percentCPUUsage: 1 },
        memory: { workingSetSize: 4096 * 1024 },
      } as Electron.ProcessMetric,
    ]);
    vi.mocked(readProcessPrivateMemoryKB).mockResolvedValue(2048);
    const metrics = new TelemetryPerfMetrics(true);
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      metrics.startReporting(1000);
      await vi.waitFor(() => {
        expect(metrics.report().totalAppPrivateMemoryMB).toBe(2);
        expect(metrics.report().processes?.[0].privateMemoryMB).toBe(2);
      });
    } finally {
      Object.defineProperty(process, 'platform', { value: platform });
      metrics.stopReporting();
    }
  });

  it('preserves source revision and worktree state from the run metadata', () => {
    vi.stubEnv(
      'PERF_SCENARIO_METADATA',
      JSON.stringify({ sourceCommit: 'abc123', sourceDirty: true })
    );

    expect(
      new TelemetryPerfMetrics(true).report().scenarioMetadata
    ).toMatchObject({ sourceCommit: 'abc123', sourceDirty: true });
  });
});

describe('SDK wait instrumentation', () => {
  const original = process.env.PERF_SDK_WAIT;

  afterEach(() => {
    if (original === undefined) delete process.env.PERF_SDK_WAIT;
    else process.env.PERF_SDK_WAIT = original;
  });

  it('stays disabled without the opt-in flag', () => {
    delete process.env.PERF_SDK_WAIT;
    const metrics = new TelemetryPerfMetrics(true);
    expect(metrics.sdkWaitEnabled).toBe(false);
    metrics.recordSdkWait(5, true, 16, 25);
    expect(metrics.report().sdkWait).toBeUndefined();
  });

  it('reports wait duration, outcomes, cadence and totals, then resets', () => {
    process.env.PERF_SDK_WAIT = '1';
    const metrics = new TelemetryPerfMetrics(true);
    expect(metrics.sdkWaitEnabled).toBe(true);

    metrics.recordSdkWait(4, true, 16, 25);
    metrics.recordSdkWait(8, false, 16, 60);
    const report = metrics.report();

    expect(report.sdkWait).toMatchObject({
      calls: 2,
      reads: 1,
      unsuccessful: 1,
      totalMs: 12,
      timeoutMs: 16,
      targetHz: 60,
    });
    expect(report.sdkWait?.durationMs).toMatchObject({
      count: 2,
      min: 4,
      max: 8,
      avg: 6,
    });
    expect(metrics.report().sdkWait?.calls).toBe(0);
  });
});
