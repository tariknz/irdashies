import { describe, expect, it } from 'vitest';
import type { NumericSampleStats } from '../../src/types/performance';
import { compareSummaries, parsePerfLog, summarizeCapture } from './analyze';

const stats = (
  avg: number,
  overrides: Partial<NumericSampleStats> = {}
): NumericSampleStats => ({
  count: 100,
  avg,
  min: avg - 5,
  max: avg + 5,
  p1: avg - 4,
  p50: avg,
  p95: avg + 3,
  p99: avg + 4,
  ...overrides,
});

function mainSample(seconds: number, memoryMB: number, fps = 100) {
  return {
    timestamp: new Date(seconds * 1000).toISOString(),
    runId: 'run',
    scenario: 'full',
    overlayMode: 'full',
    tickRateHz: 24,
    sections: {
      processTelemetry: { count: 100, avgMs: 1, maxMs: 4, p99Ms: 2 },
      broadcast: { count: 100, avgMs: 0.2, maxMs: 1, p99Ms: 0.5 },
    },
    eventLoopDelayMs: { mean: 20, max: 30, p99: 25 },
    iracing: {
      frameRate: stats(fps),
      cpuUsageForeground: stats(40),
      cpuUsageBackground: stats(5),
      gpuUsage: stats(70),
    },
    totalAppCpuPercent: 12,
    totalAppMemoryMB: memoryMB,
  };
}

describe('performance analysis', () => {
  it('parses structured records mixed with normal logs', () => {
    const main = mainSample(0, 100);
    const contents = [
      'normal output',
      `[PerfMetrics:JSON] ${JSON.stringify(main)}`,
      '[PerfRenderer:JSON] {"timestamp":"1970-01-01T00:00:00.000Z","frameTimeMs":{"count":1,"avg":16,"min":16,"max":16,"p1":16,"p50":16,"p95":16,"p99":16},"framesOver25Ms":0,"framesOver50Ms":0}',
    ].join('\n');

    expect(parsePerfLog(contents)).toMatchObject({
      main: [main],
      renderer: [{ framesOver50Ms: 0 }],
    });
  });

  it('summarizes memory slope and telemetry metrics', () => {
    const summary = summarizeCapture(
      {
        main: [mainSample(0, 100), mainSample(60, 102), mainSample(120, 104)],
        renderer: [],
      },
      0
    );

    expect(summary.app.memorySlopeMBPerMinute).toBeCloseTo(2);
    expect(summary.iracing.averageFps).toBe(100);
    expect(summary.telemetry.processTelemetryP99MeanMs).toBe(2);
  });

  it('summarizes renderer telemetry callback cost and rate', () => {
    const summary = summarizeCapture(
      {
        main: [mainSample(0, 100), mainSample(5, 100)],
        renderer: [
          {
            schemaVersion: 1,
            timestamp: new Date(0).toISOString(),
            runId: 'run',
            scenario: 'full',
            pid: 1,
            route: '/',
            visibilityState: 'visible',
            intervalMs: 5000,
            frameTimeMs: stats(16),
            telemetryCallbackMs: stats(0.2, { count: 100, p99: 0.7 }),
            framesOver25Ms: 0,
            framesOver50Ms: 0,
          },
        ],
      },
      0
    );

    expect(summary.renderer.telemetryCallbackRateHz).toBe(20);
    expect(summary.renderer.telemetryCallbackP99MeanMs).toBe(0.7);
  });

  it('flags a material iRacing FPS regression', () => {
    const baseline = summarizeCapture(
      { main: [mainSample(0, 100, 100)], renderer: [] },
      0
    );
    const candidate = summarizeCapture(
      { main: [mainSample(0, 100, 90)], renderer: [] },
      0
    );

    const comparison = compareSummaries(baseline, candidate);
    expect(comparison.delta.averageFpsPercent).toBe(-10);
    expect(comparison.checks[0].passed).toBe(false);
  });
});
