import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppMetrics: vi.fn(() => []) },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

import {
  sumCompletePrivateMemoryMB,
  TelemetryPerfMetrics,
} from './perfMetrics';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('performance process memory coverage', () => {
  it('sums private bytes only when every included process reports them', () => {
    expect(sumCompletePrivateMemoryMB([1024, 2048])).toBe(3);
    expect(sumCompletePrivateMemoryMB([1024, undefined])).toBeUndefined();
    expect(sumCompletePrivateMemoryMB([])).toBeUndefined();
  });
});

describe('performance run provenance metadata', () => {
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
