import { link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseReportOptions, runReportCli } from './report';

const summary = (
  runId: string,
  commit: string,
  peak: number,
  durationSufficient = true
) => ({
  runId,
  scenarioMetadata: { sourceCommit: commit },
  analysisWindow: { startSeconds: 0, endSeconds: 360 },
  evidence: {
    runOriginAvailable: true,
    durationSufficient,
    scenarioMetadataConsistent: true,
    inputCoverageComplete: true,
    inputCoverageAvailable: true,
    privateMemorySamplingAdequate: true,
  },
  iracing: {
    fpsObservationCount: 100,
    averageFps: 60,
    meanOnePercentLowFps: 59,
  },
  app: {
    peakMemoryMB: peak,
    averageRendererMemoryMB: peak / 2,
    averageCpuPercent: 8,
    privateMemorySlopeMBPerMinute: 0,
  },
  telemetry: {
    processTelemetryObservationCount: 100,
    processTelemetryP99MeanMs: 2,
    minimumTickRateHz: 60,
  },
  eventLoop: { p99MeanMs: 35 },
  renderer: {
    trackMapAnimationFrameP99MeanMs: 2,
    framesOver50MsPercent: 0,
    frameCount: 100,
  },
});

describe('multi-run perf report CLI', () => {
  it('rejects unknown commit provenance and preserves hard-linked comparison inputs', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const input = path.join(directory, 'comparison.json');
      await writeFile(
        input,
        JSON.stringify({
          baseline: summary('base', 'unknown', 1100),
          candidate: summary('head', 'bbb', 1200),
        })
      );
      await expect(runReportCli([input])).rejects.toThrow(
        'missing source commit'
      );
      const original = JSON.stringify({
        baseline: summary('base', 'aaa', 1100),
        candidate: summary('head', 'bbb', 1200),
      });
      await writeFile(input, original);
      const alias = path.join(directory, 'report.md');
      await link(input, alias);
      await expect(runReportCli([input, '--output', alias])).rejects.toThrow(
        'would overwrite an input file'
      );
      expect(await readFile(input, 'utf8')).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('resolves summaries and output options', () => {
    expect(
      parseReportOptions([
        'one.summary.json',
        'two.summary.json',
        '--output',
        'aggregate.md',
        '--order',
        'ab',
      ])
    ).toMatchObject({
      inputPaths: [
        path.resolve('one.summary.json'),
        path.resolve('two.summary.json'),
      ],
      outputPath: path.resolve('aggregate.md'),
      order: 'ab',
    });
  });

  it('groups reversed comparisons by commit instead of baseline/candidate role', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const forward = path.join(directory, 'forward.json');
      const reverse = path.join(directory, 'reverse.json');
      await writeFile(
        forward,
        JSON.stringify({
          baseline: summary('base-1', 'aaa', 1100),
          candidate: summary('pr-1', 'bbb', 1200),
        })
      );
      await writeFile(
        reverse,
        JSON.stringify({
          baseline: summary('pr-2', 'bbb', 1210),
          candidate: summary('base-2', 'aaa', 1110),
        })
      );
      const output = path.join(directory, 'report.md');
      await runReportCli([forward, reverse, '--output', output]);
      const markdown = await readFile(output, 'utf8');
      expect(markdown).toContain('Baseline commit: `aaa`');
      expect(markdown).toContain('Candidate commit: `bbb`');
      expect(markdown).toContain('Base median (range)');
      expect(markdown.match(/\| Peak working set \|/g)).toHaveLength(1);
      expect(markdown).toContain('1105.000 MB');
      expect(markdown).toContain('1205.000 MB');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('selects commits explicitly when summaries from more than two commits are mixed', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const first = path.join(directory, 'first.json');
      const second = path.join(directory, 'second.json');
      const third = path.join(directory, 'third.json');
      await writeFile(
        first,
        JSON.stringify({
          baseline: summary('base-1', 'aaa', 1100),
          candidate: summary('pr-1', 'bbb', 1200),
        })
      );
      await writeFile(
        second,
        JSON.stringify({
          baseline: summary('base-2', 'aaa', 1100),
          candidate: summary('other-1', 'ccc', 9000, false),
        })
      );
      await writeFile(
        third,
        JSON.stringify({
          baseline: summary('other-2', 'ccc', 9000),
          candidate: summary('pr-3', 'bbb', 8000),
        })
      );
      const output = path.join(directory, 'report.md');
      await runReportCli([
        first,
        second,
        third,
        '--baseline',
        'aaa',
        '--candidate',
        'bbb',
        '--output',
        output,
      ]);
      const markdown = await readFile(output, 'utf8');
      expect(markdown).toContain('Baseline commit: `aaa`');
      expect(markdown).toContain('Candidate commit: `bbb`');
      expect(markdown).not.toContain('`ccc`');
      expect(markdown).toContain('1200.000 MB');
      expect(markdown).not.toContain('INCONCLUSIVE');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reports unavailable baseline telemetry timing as inconclusive', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const input = path.join(directory, 'comparison.json');
      const output = path.join(directory, 'report.md');
      const baseline = summary('base', 'aaa', 1100);
      baseline.telemetry.processTelemetryObservationCount = 0;
      await writeFile(
        input,
        JSON.stringify({
          baseline,
          candidate: summary('head', 'bbb', 1200),
        })
      );
      await runReportCli([input, '--output', output]);
      const markdown = await readFile(output, 'utf8');
      expect(markdown).toContain('Verdict: **INCONCLUSIVE**');
      expect(markdown).toContain(
        'baseline telemetry timing observations are unavailable'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('withholds the verdict for short captures, saved inconclusive gates, and mismatched workloads', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const input = path.join(directory, 'comparison.json');
      const output = path.join(directory, 'report.md');
      const baseline = summary('base', 'aaa', 1100);
      const candidate = summary('pr', 'bbb', 600);
      const cases = [
        { candidate: summary('pr', 'bbb', 600, false) },
        {
          checks: [
            { passed: null, target: 'inconclusive: insufficient evidence' },
          ],
        },
        {
          candidate: {
            ...candidate,
            scenarioMetadata: { sourceCommit: 'bbb', replaySpeed: 2 },
          },
        },
      ];
      for (const overrides of cases) {
        await writeFile(
          input,
          JSON.stringify({ baseline, candidate, ...overrides })
        );
        await runReportCli([input, '--output', output]);
        expect(await readFile(output, 'utf8')).toContain(
          'Verdict: **INCONCLUSIVE**'
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects the same captures when a comparison is supplied twice', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-report-'));
    try {
      const input = path.join(directory, 'comparison.json');
      await writeFile(
        input,
        JSON.stringify({
          baseline: summary('base', 'aaa', 1100),
          candidate: summary('pr', 'bbb', 600),
        })
      );
      await expect(runReportCli([input, input])).rejects.toThrow(
        /appears more than once/
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects empty or malformed invocations', () => {
    expect(() => parseReportOptions([])).toThrow();
    expect(() => parseReportOptions(['one.json', '--unknown', '1'])).toThrow();
  });
});
