import { describe, expect, it } from 'vitest';
import type { PerfCapture } from './analyze';
import { correlateCapture } from './correlate';

const stats = (avg: number) => ({
  count: 60,
  avg,
  min: avg,
  max: avg,
  p1: avg,
  p50: avg,
  p95: avg,
  p99: avg,
});

const sampleAt = (seconds: number, fps: number, sectionP99: number) => ({
  timestamp: new Date(seconds * 1000).toISOString(),
  runId: 'run',
  scenario: 'full',
  overlayMode: 'full',
  intervalMs: 60_000,
  tickRateHz: 60,
  sections: {
    processTelemetry: {
      count: 100,
      avgMs: sectionP99 / 2,
      maxMs: sectionP99,
      p99Ms: sectionP99,
    },
  },
  eventLoopDelayMs: { mean: 5, max: 8, p99: 6 },
  iracing: {
    frameRate: stats(fps),
    cpuUsageForeground: stats(20),
    cpuUsageBackground: stats(5),
    gpuUsage: stats(50),
  },
  channelMetrics: {
    processorExecutions: {},
    publications: {},
    deliveries: {},
  },
});

const buildCapture = (dip: boolean): PerfCapture =>
  ({
    main: Array.from({ length: 7 }, (_, index) =>
      sampleAt(index * 60, dip && index === 3 ? 40 : 100, dip && index === 3 ? 20 : 2)
    ),
    renderer: [],
    visibility: [],
    origins: [
      { timestamp: new Date(0).toISOString(), runId: 'run' },
    ],
  }) as unknown as PerfCapture;

describe('perf log correlation', () => {
  it('finds the instrumented peak that coincides with an FPS dip', () => {
    const findings = correlateCapture(buildCapture(true), {
      warmupSeconds: 0,
      analysisWindow: {},
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('T+180s');
    expect(findings[0].evidence[0]).toContain('40.0');
    expect(findings[0].evidence.join(' ')).toContain('processTelemetry');
    expect(findings[0].nextStep).toContain('T+175s');
  });

  it('stays quiet for a stable workload', () => {
    expect(
      correlateCapture(buildCapture(false), {
        warmupSeconds: 0,
        analysisWindow: {},
      })
    ).toEqual([]);
  });

  it('does not speculate when the analysis window is too short', () => {
    const capture = buildCapture(true);
    capture.main = capture.main.slice(0, 3);
    expect(
      correlateCapture(capture, {
        warmupSeconds: 0,
        analysisWindow: {},
      })
    ).toEqual([]);
  });
});
