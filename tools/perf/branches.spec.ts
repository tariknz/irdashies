import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PerfSummary } from './analyze';
import {
  branchesReportMarkdown,
  aggregateBranchRuns,
  parseBranchesOptions,
  parseDiffSpec,
  type BranchesReport,
} from './branches';

describe('branch performance runner options', () => {
  it('parses diff shorthands and explicit refs', () => {
    expect(parseDiffSpec('main...HEAD')).toEqual({
      baseline: 'main',
      candidate: 'HEAD',
    });
    expect(parseDiffSpec('v1..v2')).toEqual({
      baseline: 'v1',
      candidate: 'v2',
    });
    expect(parseDiffSpec('abc123')).toEqual({
      baseline: 'abc123^',
      candidate: 'abc123',
    });

    const options = parseBranchesOptions([
      '--input',
      'session.irdt',
      '--diff',
      'main...feat/pr',
    ]);
    expect(options.refs).toEqual({ baseline: 'main', candidate: 'feat/pr' });
    expect(options.inputPath).toBe(path.resolve('session.irdt'));
    expect(options.target).toBe('dev');
    expect(options.keepWorktrees).toBe(false);
    expect(
      parseBranchesOptions(['--input', 'session.irdt', '--dry-run']).dryRun
    ).toBe(true);
    const abba = parseBranchesOptions([
      '--input',
      'session.irdt',
      '--pairs',
      '2',
      '--pr',
      '949',
    ]);
    expect(abba).toMatchObject({
      pairs: 2,
      order: 'abba',
      pr: 949,
      reuse: true,
      ignoreGates: [],
    });
    expect(
      parseBranchesOptions([
        '--input',
        'session.irdt',
        '--replay-speed',
        '100',
        '--sdk-wait',
      ])
    ).toMatchObject({ replaySpeed: 100, sdkWait: true });
    expect(
      parseBranchesOptions([
        '--input',
        'session.irdt',
        '--no-reuse',
        '--ignore-gates',
        'memory,FPS',
      ])
    ).toMatchObject({ reuse: false, ignoreGates: ['memory', 'FPS'] });
    expect(parseBranchesOptions(['--clean-cache'])).toMatchObject({
      cleanCache: true,
      reuse: false,
    });
    const smoke = parseBranchesOptions([
      '--input',
      'session.irdt',
      '--smoke',
      '--coverage-probe-seconds',
      '30',
    ]);
    expect(smoke).toMatchObject({
      durationSeconds: 60,
      warmupSeconds: 0,
      order: 'ab',
      allowInconclusive: true,
      coverageProbeSeconds: 30,
    });
  });

  it('keeps explicit refs and parse options strict', () => {
    expect(
      parseBranchesOptions([
        '--input',
        'session.irdt',
        '--baseline',
        'origin/main',
        '--candidate',
        'HEAD',
        '--widgets',
        'map',
        '--window-mode',
        'widget',
        '--replay-visible-widgets',
      ])
    ).toMatchObject({
      refs: { baseline: 'origin/main', candidate: 'HEAD' },
      widgets: 'map',
      windowMode: 'widget',
      replayVisibleWidgets: true,
    });
    expect(() =>
      parseBranchesOptions(['--input', 'session.irdt', '--unknown', '1'])
    ).toThrow();
    expect(() =>
      parseBranchesOptions([
        '--input',
        'session.irdt',
        '--duration-seconds',
        '120',
        '--warmup-seconds',
        '200',
      ])
    ).toThrow();
    expect(() => parseBranchesOptions([])).toThrow(/--input is required/);
  });

  it.each(['--install', '--rebuild-native'])(
    'uses fresh worktrees for %s',
    (flag) => {
      expect(
        parseBranchesOptions(['--input', 'session.irdt', '--reuse', flag])
      ).toMatchObject({ reuse: false });
    }
  );

  it('separates reproducible effects from run-order noise', () => {
    const summary = (peak: number, cpu: number) =>
      ({
        app: { peakMemoryMB: peak, averageCpuPercent: cpu },
        telemetry: { processTelemetryP99MeanMs: 2 },
        eventLoop: { p99MeanMs: 35 },
        renderer: { trackMapAnimationFrameP99MeanMs: 2, framesOver50MsPercent: 0 },
      }) as unknown as PerfSummary;
    const runs = [
      { label: 'baseline' as const, cycle: 0, position: 1, runId: 'a', logPath: '', summary: summary(1264, 8.2) },
      { label: 'candidate' as const, cycle: 0, position: 2, runId: 'b', logPath: '', summary: summary(1087, 8.1) },
      { label: 'candidate' as const, cycle: 0, position: 3, runId: 'c', logPath: '', summary: summary(1265, 8.0) },
      { label: 'baseline' as const, cycle: 0, position: 4, runId: 'd', logPath: '', summary: summary(1088, 8.2) },
    ];
    const aggregate = aggregateBranchRuns(runs);
    const memory = aggregate.metrics.find(
      (metric) => metric.key === 'peakMemoryMB'
    );
    const cpu = aggregate.metrics.find(
      (metric) => metric.key === 'appCpuPercent'
    );

    expect(aggregate.verdict).toBe('NO REPRODUCIBLE EFFECT');
    expect(memory?.noise).toBeGreaterThan(150);
    expect(memory?.reproducible).toBe(false);
    expect(cpu?.reproducible).toBe(false);
  });

  it('renders provenance and changed files in the report', () => {
    const base = {
      ref: 'main',
      commit: 'aaa',
      directory: '/a',
      generatedWorktree: true,
      logPath: '/a.log',
    };
    const report: BranchesReport = {
      options: parseBranchesOptions(['--input', 'session.irdt']),
      baseline: { ...base, label: 'baseline' },
      candidate: {
        ...base,
        label: 'candidate',
        ref: 'feat/pr',
        commit: 'bbb',
      },
      aggregate: {
        runsPerSide: 1,
        metrics: [],
        verdict: 'NO REPRODUCIBLE EFFECT',
      },
      changedFiles: ['M\ttools/perf/run.ts'],
      nativeChanged: false,
      dependenciesChanged: false,
      comparisonPath: '/compare.md',
      diagnosisPath: '/diagnosis.md',
      conclusive: true,
    };
    const markdown = branchesReportMarkdown(report);

    expect(markdown).toContain('aaa');
    expect(markdown).toContain('bbb');
    expect(markdown).toContain('tools/perf/run.ts');
    expect(markdown).toContain('CONCLUSIVE');
  });
});
