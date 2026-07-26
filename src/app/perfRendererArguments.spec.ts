import { describe, expect, it } from 'vitest';
import {
  createRendererPerfArguments,
  readRendererPerfArguments,
} from './perfRendererArguments';

describe('renderer performance arguments', () => {
  it('creates no renderer arguments when profiling is disabled', () => {
    expect(createRendererPerfArguments({})).toEqual([]);
  });

  it('round-trips a sanitized performance configuration', () => {
    const args = createRendererPerfArguments({
      PERF_METRICS: '1',
      PERF_RUN_ID: 'run 1',
      PERF_SCENARIO: 'full/dashboard',
      PERF_REPORT_INTERVAL_MS: '5000',
    });

    expect(readRendererPerfArguments(args)).toEqual({
      enabled: true,
      runId: 'run-1',
      scenario: 'full-dashboard',
      reportIntervalMs: 5000,
    });
  });
});
