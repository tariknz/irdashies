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
    metrics.startReporting(1000);
    try {
      await vi.waitFor(() => {
        expect(metrics.report().totalAppPrivateMemoryMB).toBe(2);
        expect(metrics.report().processes?.[0].privateMemoryMB).toBe(2);
      });
    } finally {
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
