import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareSummaries, parsePerfLog, summarizeCapture } from './analyze';
import {
  diagnosePerfComparison,
  diagnosePerfSummary,
  diagnoseReplayReport,
  diagnosisMarkdown,
  parseDiagnoseOptions,
  runDiagnosisCli,
} from './diagnose';

const sampleLog = `[PerfRunOrigin:JSON] {"timestamp":"2026-01-01T00:00:00.000Z","runId":"diagnose-test"}
[PerfMetrics:JSON] ${JSON.stringify({
  timestamp: '2026-01-01T00:01:00.000Z',
  runId: 'diagnose-test',
  scenario: 'full-dashboard',
  overlayMode: 'full',
  intervalMs: 60_000,
  tickRateHz: 24,
  sections: {
    processTelemetry: { count: 100, avgMs: 4, maxMs: 8, p99Ms: 6 },
    broadcast: { count: 100, avgMs: 1, maxMs: 2, p99Ms: 1.5 },
  },
  eventLoopDelayMs: { mean: 10, max: 12, p99: 11 },
  iracing: {
    frameRate: {
      count: 100,
      avg: 90,
      min: 80,
      max: 100,
      p1: 80,
      p50: 90,
      p95: 98,
      p99: 99,
    },
    cpuUsageForeground: {
      count: 100,
      avg: 20,
      min: 10,
      max: 30,
      p1: 10,
      p50: 20,
      p95: 28,
      p99: 29,
    },
    cpuUsageBackground: {
      count: 100,
      avg: 5,
      min: 1,
      max: 10,
      p1: 1,
      p50: 5,
      p95: 9,
      p99: 10,
    },
    gpuUsage: {
      count: 100,
      avg: 30,
      min: 10,
      max: 50,
      p1: 10,
      p50: 30,
      p95: 48,
      p99: 49,
    },
  },
  totalAppCpuPercent: 10,
  totalAppMemoryMB: 1000,
  totalAppPrivateMemoryMB: 900,
  scenarioMetadata: {
    activeWidgetTypes: [],
    widgetInputRequirements: {},
  },
  channelMetrics: {
    processorExecutions: {},
    publications: {},
    deliveries: {},
  },
})}`;

function summary() {
  return summarizeCapture(parsePerfLog(sampleLog), 0);
}

describe('performance diagnosis', () => {
  it('turns failed project gates into cautious investigation leads', () => {
    const result = summary();
    result.evidence.conclusive = true;
    result.evidence.privateMemorySamplingAdequate = true;
    result.evidence.privateMemorySampleCount = 6;
    result.evidence.privateMemorySpanSeconds = 300;
    result.app.privateMemorySlopeMBPerMinute = 8;
    result.telemetry.processTelemetryP99MeanMs = 4;
    result.telemetry.minimumTickRateHz = 18;
    result.renderer.framesOver50MsPercent = 0.2;
    result.renderer.worstFrameMs = 75;
    result.eventLoop.worstStallMs = 80;

    const diagnosis = diagnosePerfSummary(result);

    expect(diagnosis.findings.map(({ id }) => id)).toEqual([
      'main-section-hotspots',
      'main-section-cumulative-work',
      'private-memory-growth',
      'telemetry-processing-latency',
      'telemetry-tick-rate',
      'renderer-long-frames',
      'main-event-loop-stall',
    ]);
    expect(diagnosis.conclusion).toContain('not root-cause findings');
    expect(
      diagnosis.findings.find(({ id }) => id === 'private-memory-growth')
        ?.nextStep
    ).toContain('does not prove a leak');
  });

  it('reports evidence limitations and does not treat an inadequate memory slope as a leak', () => {
    const result = summary();
    result.telemetry.processTelemetryP99MeanMs = 0;
    result.app.privateMemorySlopeMBPerMinute = 20;
    result.evidence.privateMemorySamplingAdequate = false;
    result.evidence.conclusive = false;
    result.evidence.inconclusiveReasons = ['short analysis duration'];

    const diagnosis = diagnosePerfSummary(result);

    expect(diagnosis.findings.map(({ id }) => id)).toEqual([
      'incomplete-evidence',
      'main-section-hotspots',
      'main-section-cumulative-work',
    ]);
    expect(diagnosis.findings[0].evidence).toEqual(['short analysis duration']);
    expect(
      diagnosis.findings.some(({ id }) => id === 'private-memory-growth')
    ).toBe(false);
    expect(diagnosisMarkdown(diagnosis)).toContain('INCONCLUSIVE');
    expect(diagnosisMarkdown(diagnosis)).toContain('short analysis duration');
  });

  it('separates rare p99 spikes from frequently accumulated section work', () => {
    const result = summary();
    result.evidence.conclusive = true;
    result.sections = {
      sdkSessionRead: {
        sampleCount: 10,
        operationCount: 143,
        averageMeanMs: 1.2,
        p99MeanMs: 1.68,
        p99WorstMs: 10.98,
      },
      processTelemetry: {
        sampleCount: 10,
        operationCount: 95_000,
        averageMeanMs: 0.6,
        p99MeanMs: 1.17,
        p99WorstMs: 2.33,
      },
    };

    const diagnosis = diagnosePerfSummary(result);
    const p99 = diagnosis.findings.find(
      ({ id }) => id === 'main-section-hotspots'
    );
    const cumulative = diagnosis.findings.find(
      ({ id }) => id === 'main-section-cumulative-work'
    );

    expect(p99?.evidence[0]).toContain('sdkSessionRead');
    expect(cumulative?.evidence[0]).toContain('processTelemetry');
    expect(cumulative?.nextStep).toContain('do not sum these values');
  });

  it('ranks main sections by interval p99 and renderer callbacks by measured p99', () => {
    const result = summary();
    result.evidence.conclusive = true;
    result.telemetry.processTelemetryP99MeanMs = 0;
    result.renderer.sampleCount = 10;
    result.renderer.radarFrameRateHz = 30;
    result.renderer.radarFrameP99MeanMs = 4;
    result.renderer.radarFrameP99WorstMs = 8;
    result.renderer.inputTraceFrameRateHz = 60;
    result.renderer.inputTraceFrameP99MeanMs = 1;
    result.renderer.inputTraceFrameP99WorstMs = 2;

    const diagnosis = diagnosePerfSummary(result);
    const mainHotspots = diagnosis.findings.find(
      ({ id }) => id === 'main-section-hotspots'
    );
    const rendererHotspots = diagnosis.findings.find(
      ({ id }) => id === 'renderer-measure-hotspots'
    );

    expect(mainHotspots?.evidence[0]).toContain('processTelemetry');
    expect(rendererHotspots?.evidence[0]).toContain('Radar draw');
    expect(rendererHotspots?.evidence[1]).toContain('Input Trace draw');
    expect(rendererHotspots?.nextStep).toContain(
      'not complete React render costs'
    );
  });

  it('diagnoses replay reports using coverage and source-delivery evidence', () => {
    const diagnosis = diagnoseReplayReport(
      {
        finished: false,
        mode: 'stress',
        requestedSpeed: 'max',
        input: {
          format: 'ibt',
          durationSeconds: 120,
          warnings: ['Recording is missing Brake.'],
        },
        playback: {
          elapsedSeconds: 30,
          sourceFramesConsumed: 100,
          sdkFramesReturned: 90,
          sourceFramesSuperseded: 10,
          sourceFailed: false,
        },
        resources: {
          completeProcessCoverage: false,
          totalCpuMsPerSecond: null,
          processes: [{ type: 'Tab', cpuMsPerSecond: null }],
        },
        observations: {
          processingSections: {
            processTelemetry: {
              count: 10,
              totalWallMs: 40,
              maxWallMs: 8,
            },
          },
        },
        coverage: [
          { widget: 'input', status: 'missing-fields', missing: ['Brake'] },
        ],
        widgets: [
          {
            id: 'input-widget',
            wrapperObserved: false,
            coverage: 'not observed',
          },
        ],
        limitations: ['Single run is descriptive.'],
      },
      'replay-report.json'
    );

    expect(diagnosis.source).toBe('replay-report');
    expect(diagnosis.run.evidenceConclusive).toBe(false);
    expect(diagnosis.findings.map(({ id }) => id)).toEqual([
      'descriptive-replay-run',
      'replay-input-warnings',
      'replay-incomplete',
      'replay-source-frames-superseded',
      'replay-resource-coverage',
      'largest-replay-processing-section',
      'replay-recording-field-coverage',
      'replay-widget-mount-coverage',
    ]);
  });

  it('adds failed comparison gates to candidate diagnosis', () => {
    const baseline = summary();
    const candidate = summary();
    baseline.evidence.conclusive = true;
    candidate.evidence.conclusive = true;
    baseline.evidence.durationSufficient = true;
    candidate.evidence.durationSufficient = true;
    baseline.evidence.privateMemorySamplingAdequate = true;
    candidate.evidence.privateMemorySamplingAdequate = true;
    baseline.app.privateMemorySlopeMBPerMinute = 1;
    candidate.app.privateMemorySlopeMBPerMinute = 1;
    baseline.scenarioMetadata.sourceCommit = 'before-sha';
    baseline.scenarioMetadata.sourceDirty = false;
    candidate.scenarioMetadata.sourceCommit = 'after-sha';
    candidate.scenarioMetadata.sourceDirty = true;
    const comparison = compareSummaries(baseline, candidate);
    const failedCheck = comparison.checks.find(
      (check) => check.name === 'Telemetry processing p99'
    );
    if (!failedCheck) throw new Error('Missing telemetry check');
    failedCheck.passed = false;
    failedCheck.actual = 1;
    failedCheck.target = 'must pass';

    const diagnosis = diagnosePerfComparison(comparison);

    expect(diagnosis.source).toBe('perf-comparison');
    expect(
      diagnosis.findings.find(({ id }) => id === 'comparison-provenance')
        ?.evidence
    ).toEqual(
      expect.arrayContaining([
        'Baseline source: before-sha (clean worktree).',
        'Candidate source: after-sha (dirty worktree).',
      ])
    );
    expect(diagnosis.findings.at(-1)?.id).toBe('baseline-checks-failed');
    expect(diagnosis.findings.at(-1)?.evidence[0]).toContain('must pass');
  });

  it('deduplicates repeated evidence limitations across comparison gates', () => {
    const comparison = compareSummaries(summary(), summary());

    const diagnosis = diagnosePerfComparison(comparison);
    const finding = diagnosis.findings.find(
      ({ id }) => id === 'baseline-checks-inconclusive'
    );

    expect(finding).toBeDefined();
    expect(finding?.evidence.length).toBeLessThan(comparison.checks.length);
    expect(finding?.evidence[0]).toContain('gates:');
  });

  it('does not call deliberately ignored gates inconclusive', () => {
    const baseline = summary();
    const candidate = summary();
    for (const result of [baseline, candidate]) {
      result.evidence.durationSufficient = true;
      result.evidence.privateMemorySamplingAdequate = true;
      result.app.privateMemorySlopeMBPerMinute = 1;
    }
    const comparison = compareSummaries(baseline, candidate, [], ['FPS']);
    const diagnosis = diagnosePerfComparison(comparison);

    expect(
      diagnosis.findings.some(
        (finding) => finding.id === 'baseline-checks-inconclusive'
      )
    ).toBe(false);
  });

  it('reports unexercised widget inputs and escapes report text for Markdown', () => {
    const result = summary();
    result.evidence.conclusive = true;
    result.evidence.inconclusiveReasons = [];
    result.telemetry.processTelemetryP99MeanMs = 0;
    result.widgetInputs = {
      'input|widget': {
        covered: false,
        inputs: {
          'driver.controls': {
            observed: false,
            changeRateHz: 0,
            deliveryRateHz: 0,
          },
        },
      },
    };

    const diagnosis = diagnosePerfSummary(result);
    const markdown = diagnosisMarkdown(diagnosis);

    expect(diagnosis.findings.map(({ id }) => id)).toEqual([
      'main-section-hotspots',
      'main-section-cumulative-work',
      'widget-input-coverage',
    ]);
    expect(markdown).toContain('input\\|widget');
    expect(markdown).toContain('No evidence limitations');
  });
});

  it('rejects a summary with malformed sdkWait instrumentation', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-diagnose-'));
    try {
      const result = summary();
      const input = path.join(directory, 'summary.json');
      await writeFile(
        input,
        JSON.stringify({ ...result, sdkWait: {} })
      );
      await expect(
        runDiagnosisCli([
          input,
          '--output',
          path.join(directory, 'diagnosis'),
        ])
      ).rejects.toThrow(/not a recognized/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

describe('diagnose CLI options', () => {
  it('accepts analysis windows and computes sidecar output paths', () => {
    expect(
      parseDiagnoseOptions([
        'perf-results/run.log',
        '--warmup-seconds',
        '10',
        '--analysis-start-seconds',
        '30',
        '--analysis-end-seconds',
        '300',
      ])
    ).toMatchObject({
      inputPath: expect.stringMatching(/perf-results[\\/]run\.log$/),
      outputPrefix: expect.stringMatching(/perf-results[\\/]run\.diagnosis$/),
      warmupSeconds: 10,
      analysisWindow: { startSeconds: 30, endSeconds: 300 },
    });
  });

  it('accepts output and failure-threshold options', () => {
    expect(
      parseDiagnoseOptions([
        'run.log',
        '--format',
        'json',
        '--fail-on',
        'caution',
        '--no-correlate',
      ])
    ).toMatchObject({
      format: 'json',
      failOn: 'caution',
      correlateRawLog: false,
    });
    expect(() =>
      parseDiagnoseOptions(['run.log', '--fail-on', 'critical'])
    ).toThrow();
  });

  it.each([
    [],
    ['run.log', '--unknown', '1'],
    ['run.log', '--warmup-seconds', '-1'],
    [
      'run.log',
      '--analysis-start-seconds',
      '30',
      '--analysis-end-seconds',
      '20',
    ],
    ['run.log', '--output'],
    ['one.log', 'two.log'],
  ])('rejects malformed arguments: %s', (...args) => {
    expect(() => parseDiagnoseOptions(args)).toThrow();
  });
});
