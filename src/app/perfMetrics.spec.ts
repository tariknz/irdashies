import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sumCompletePrivateMemoryMB,
  TelemetryPerfMetrics,
} from './perfMetrics';

vi.mock('electron', () => ({
  app: { getAppMetrics: () => [] },
  BrowserWindow: { getAllWindows: () => [] },
}));

describe('performance process memory coverage', () => {
  it('sums private bytes only when every included process reports them', () => {
    expect(sumCompletePrivateMemoryMB([1024, 2048])).toBe(3);
    expect(sumCompletePrivateMemoryMB([1024, undefined])).toBeUndefined();
    expect(sumCompletePrivateMemoryMB([])).toBeUndefined();
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
