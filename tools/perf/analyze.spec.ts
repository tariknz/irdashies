import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  NumericSampleStats,
  RendererPerfSample,
} from '../../src/types/performance';
import {
  compareSummaries,
  comparisonMarkdown,
  parseCliArgs,
  parsePerfLog,
  summarizeCapture,
} from './analyze';

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

function mainSample(
  seconds: number,
  memoryMB: number,
  fps = 100,
  privateMemoryMB = memoryMB,
  intervalMs?: number
) {
  return {
    timestamp: new Date(seconds * 1000).toISOString(),
    runId: 'run',
    scenario: 'full',
    overlayMode: 'full',
    intervalMs,
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
    totalAppPrivateMemoryMB: privateMemoryMB,
    scenarioMetadata: {
      activeWidgetTypes: ['standings'],
      widgetInputRequirements: {
        standings: ['standings.snapshot'],
      },
    },
    channelMetrics: {
      processorExecutions: { 'standings.snapshot': 100 },
      publications: { 'standings.snapshot': 20 },
      deliveries: { 'standings.snapshot': 20 },
    },
  };
}

type TestMainSample = Omit<
  ReturnType<typeof mainSample>,
  'totalAppPrivateMemoryMB'
> & {
  totalAppPrivateMemoryMB?: number;
};

const capture = (
  main: TestMainSample[],
  visibility: {
    timestamp: string;
    runId: string;
    index: number;
    visibility: 'visible' | 'hidden';
    durationSeconds: number;
  }[] = [],
  originSeconds = 0
) => ({
  main,
  renderer: [] as RendererPerfSample[],
  visibility,
  origins: [
    {
      timestamp: new Date(originSeconds * 1000).toISOString(),
      runId: 'run',
    },
  ],
});

const conclusiveSamples = (fps = 100) =>
  Array.from({ length: 6 }, (_, index) =>
    mainSample(index * 60, 100 + index, fps, 200 + index * 2)
  );

describe('performance analysis', () => {
  it('parses structured records mixed with normal logs', () => {
    const main = mainSample(5, 100, 100, 100, 5000);
    const contents = [
      'normal output',
      '[PerfRunOrigin:JSON] {"timestamp":"1970-01-01T00:00:00.000Z","runId":"run"}',
      `[PerfMetrics:JSON] ${JSON.stringify(main)}`,
      '[PerfRenderer:JSON] {"timestamp":"1970-01-01T00:00:05.000Z","intervalMs":5000,"frameTimeMs":{"count":1,"avg":16,"min":16,"max":16,"p1":16,"p50":16,"p95":16,"p99":16},"framesOver25Ms":0,"framesOver50Ms":0}',
      '[PerfVisibility:JSON] {"timestamp":"1970-01-01T00:00:00.000Z","runId":"run","index":0,"visibility":"visible","durationSeconds":60}',
    ].join('\n');

    expect(parsePerfLog(contents)).toMatchObject({
      main: [main],
      renderer: [{ framesOver50Ms: 0 }],
      visibility: [{ visibility: 'visible' }],
      origins: [{ runId: 'run' }],
    });
  });

  it('summarizes memory slope and telemetry metrics', () => {
    const summary = summarizeCapture(
      capture([mainSample(0, 100), mainSample(60, 102), mainSample(120, 104)]),
      0
    );

    expect(summary.app.memorySlopeMBPerMinute).toBeCloseTo(2);
    expect(summary.app.privateMemorySlopeMBPerMinute).toBeCloseTo(2);
    expect(summary.iracing.averageFps).toBe(100);
    expect(summary.telemetry.processTelemetryP99MeanMs).toBe(2);
    expect(summary.widgetInputs.standings.inputs['standings.snapshot']).toEqual(
      expect.objectContaining({ observed: true })
    );
  });

  it('summarizes renderer telemetry callback cost and rate', () => {
    const input = capture([
      mainSample(5, 100, 100, 100, 5000),
      mainSample(10, 100, 100, 100, 5000),
    ]);
    input.renderer = [
      {
        schemaVersion: 1,
        timestamp: new Date(5_000).toISOString(),
        runId: 'run',
        scenario: 'full',
        pid: 1,
        route: '/',
        visibilityState: 'visible',
        intervalMs: 5000,
        frameTimeMs: stats(16),
        telemetryCallbackMs: stats(0.2, { count: 100, p99: 0.7 }),
        trackMapAnimationFrameMs: stats(0.4, { count: 250, p99: 1.1 }),
        framesOver25Ms: 0,
        framesOver50Ms: 0,
      },
    ];
    const summary = summarizeCapture(input, 0);

    expect(summary.renderer.telemetryCallbackRateHz).toBe(20);
    expect(summary.renderer.telemetryCallbackP99MeanMs).toBe(0.7);
    expect(summary.renderer.trackMapAnimationFrameRateHz).toBe(50);
    expect(summary.renderer.trackMapAnimationFrameP99MeanMs).toBe(1.1);
    expect(summary.renderer.trackMapAnimationFrameP99WorstMs).toBe(1.1);

    const candidate = {
      ...summary,
      renderer: {
        ...summary.renderer,
        trackMapAnimationFrameRateHz: 60,
        trackMapAnimationFrameP99MeanMs: 1.6,
      },
    };
    const comparison = compareSummaries(summary, candidate);
    expect(comparison.delta.trackMapAnimationFrameRateHz).toBe(10);
    expect(comparison.delta.trackMapAnimationFrameP99Ms).toBeCloseTo(0.5);
    expect(comparisonMarkdown(comparison)).toContain(
      '| Track-map animation-frame p99 mean | 0.500 ms |'
    );
  });

  it('flags a material iRacing FPS regression with conclusive evidence', () => {
    const baseline = summarizeCapture(capture(conclusiveSamples(100)), 0);
    const candidate = summarizeCapture(capture(conclusiveSamples(90)), 0);

    const comparison = compareSummaries(baseline, candidate);
    expect(comparison.delta.averageFpsPercent).toBe(-10);
    expect(comparison.checks[0].passed).toBe(false);
  });

  it('anchors fixed windows to the explicit origin and includes overlapping intervals', () => {
    const summary = summarizeCapture(
      capture(
        [
          mainSample(100, 50, 100, 50, 10_000),
          mainSample(105, 100, 100, 100, 10_000),
          mainSample(115, 102, 100, 102, 10_000),
        ],
        [],
        100
      ),
      0,
      { startSeconds: 0, endSeconds: 12 }
    );

    expect(summary.sampleCount).toBe(2);
    expect(summary.durationMinutes).toBeCloseTo(0.2);
    expect(summary.analysisWindow).toEqual({
      startSeconds: 0,
      endSeconds: 12,
    });
  });

  it('uses private memory as the conclusive memory gate', () => {
    const samples = Array.from({ length: 6 }, (_, index) =>
      mainSample(index * 60, 100 + index * 100, 100, 200 + index * 2)
    );
    const summary = summarizeCapture(capture(samples), 0);
    const comparison = compareSummaries(summary, summary);
    const memoryCheck = comparison.checks.find((check) =>
      check.name.includes('private-memory')
    );

    expect(summary.evidence.conclusive).toBe(true);
    expect(summary.app.memorySlopeMBPerMinute).toBeCloseTo(100);
    expect(summary.app.privateMemorySlopeMBPerMinute).toBeCloseTo(2);
    expect(memoryCheck?.passed).toBe(true);
  });

  it('marks all checks inconclusive when private bytes are missing', () => {
    const samples = conclusiveSamples().map((sample) => ({
      ...sample,
      totalAppPrivateMemoryMB: undefined,
    }));
    const summary = summarizeCapture(capture(samples), 0);
    const comparison = compareSummaries(summary, summary);

    expect(summary.evidence.privateMemoryAvailable).toBe(false);
    expect(summary.evidence.conclusive).toBe(false);
    expect(comparison.checks.every((check) => check.passed === null)).toBe(
      true
    );
  });

  it('requires publication rather than processor execution for visible coverage', () => {
    const samples = conclusiveSamples().map((sample) => ({
      ...sample,
      channelMetrics: {
        ...sample.channelMetrics,
        publications: { 'standings.snapshot': 0 },
      },
    }));
    const summary = summarizeCapture(capture(samples), 0);

    expect(summary.widgetInputs.standings.covered).toBe(false);
    expect(summary.evidence.inputCoverageComplete).toBe(false);
    expect(summary.phaseEvidence[0].reasons).toContain(
      'one or more active widget inputs did not publish'
    );
  });

  it('accepts visible changes and zero hidden execution/delivery per phase', () => {
    const visibility = [
      {
        timestamp: new Date(0).toISOString(),
        runId: 'run',
        index: 0,
        visibility: 'visible' as const,
        durationSeconds: 300,
      },
      {
        timestamp: new Date(300_000).toISOString(),
        runId: 'run',
        index: 1,
        visibility: 'hidden' as const,
        durationSeconds: 300,
      },
    ];
    const samples = Array.from({ length: 10 }, (_, index) => {
      const seconds = (index + 1) * 60;
      const sample = mainSample(seconds, 100 + index, 100, 200 + index, 60_000);
      return seconds <= 300
        ? sample
        : {
            ...sample,
            channelMetrics: {
              processorExecutions: { 'standings.snapshot': 0 },
              publications: { 'standings.snapshot': 0 },
              deliveries: { 'standings.snapshot': 0 },
            },
          };
    });
    const summary = summarizeCapture(capture(samples, visibility), 0);

    expect(summary.phaseEvidence).toEqual([
      expect.objectContaining({ expectedBehaviorSatisfied: true }),
      expect.objectContaining({ expectedBehaviorSatisfied: true }),
    ]);
    expect(summary.evidence.inputCoverageComplete).toBe(true);
    expect(summary.evidence.conclusive).toBe(true);
  });

  it('rejects processor activity during a hidden phase', () => {
    const samples = conclusiveSamples().map((sample) => ({
      ...sample,
      channelMetrics: {
        processorExecutions: { 'standings.snapshot': 1 },
        publications: { 'standings.snapshot': 0 },
        deliveries: { 'standings.snapshot': 0 },
      },
    }));
    const visibility = [
      {
        timestamp: new Date(0).toISOString(),
        runId: 'run',
        index: 0,
        visibility: 'hidden' as const,
        durationSeconds: 301,
      },
    ];
    const summary = summarizeCapture(capture(samples, visibility), 0);

    expect(summary.phaseEvidence[0].expectedBehaviorSatisfied).toBe(false);
    expect(summary.phaseEvidence[0].reasons).toContain(
      'hidden phase executed demand-driven processors'
    );
  });

  it('rejects inconsistent scenario metadata', () => {
    const samples = conclusiveSamples();
    samples[1] = {
      ...samples[1],
      scenarioMetadata: {
        ...samples[1].scenarioMetadata,
        activeWidgetTypes: [],
      },
    };
    const summary = summarizeCapture(capture(samples), 0);

    expect(summary.evidence.scenarioMetadataConsistent).toBe(false);
    expect(summary.evidence.conclusive).toBe(false);
  });

  it('rejects one private observation and excessive sample gaps', () => {
    const oneSample = summarizeCapture(
      capture([mainSample(300, 100, 100, 100, 300_000)]),
      0
    );
    const sparse = summarizeCapture(
      capture([
        mainSample(60, 100, 100, 100, 60_000),
        mainSample(360, 102, 100, 102, 300_000),
      ]),
      0
    );

    expect(oneSample.evidence.privateMemorySampleCount).toBe(1);
    expect(oneSample.evidence.privateMemorySamplingAdequate).toBe(false);
    expect(oneSample.app.privateMemorySlopeMBPerMinute).toBeNaN();
    expect(sparse.evidence.privateMemoryMaxGapSeconds).toBe(300);
    expect(sparse.evidence.privateMemorySamplingAdequate).toBe(false);
  });

  it('requires conclusive evidence by default in the CLI', () => {
    expect(parseCliArgs(['candidate.log']).requireConclusive).toBe(true);
    expect(
      parseCliArgs(['candidate.log', '--allow-inconclusive']).requireConclusive
    ).toBe(false);
  });

  it('accepts value flags before the candidate path', () => {
    const options = parseCliArgs([
      '--analysis-start-seconds',
      '60',
      '--warmup-seconds',
      '10',
      'candidate.log',
      '--baseline',
      'baseline.log',
    ]);

    expect(options.candidatePath).toBe(path.resolve('candidate.log'));
    expect(options.baselinePath).toBe(path.resolve('baseline.log'));
    expect(options.warmupSeconds).toBe(10);
    expect(options.analysisWindow.startSeconds).toBe(60);
  });

  it('treats missing nested channel metrics as zero', () => {
    const sample = mainSample(0, 100);
    sample.channelMetrics = {
      processorExecutions: { 'standings.snapshot': 100 },
      publications: undefined,
      deliveries: { 'standings.snapshot': 20 },
    } as never;

    const summary = summarizeCapture(capture([sample]), 0);

    expect(summary.channels['standings.snapshot']).toMatchObject({
      processorExecutions: 100,
      publications: 0,
      deliveries: 20,
    });
    expect(summary.evidence.inputCoverageAvailable).toBe(false);
    expect(summary.evidence.conclusive).toBe(false);
    expect(summary.phaseEvidence[0].reasons).toContain(
      'phase channel metrics are incomplete'
    );
  });

  it('rejects non-numeric channel metric values', () => {
    const sample = mainSample(0, 100);
    sample.channelMetrics = {
      processorExecutions: { 'standings.snapshot': 100 },
      publications: { 'standings.snapshot': '20' },
      deliveries: { 'standings.snapshot': Number.NaN },
    } as never;

    const summary = summarizeCapture(capture([sample]), 0);

    expect(summary.channels['standings.snapshot']).toMatchObject({
      processorExecutions: 100,
      publications: 0,
      deliveries: 0,
    });
    expect(summary.evidence.inputCoverageAvailable).toBe(false);
    expect(summary.evidence.conclusive).toBe(false);
    expect(summary.phaseEvidence[0].reasons).toContain(
      'phase channel metrics are incomplete'
    );
  });
});
