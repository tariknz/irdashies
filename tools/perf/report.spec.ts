import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseReportOptions, runReportCli } from './report';

describe('multi-run perf report CLI', () => {
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
      const summary = (runId: string, commit: string, peak: number) =>
        ({
          runId,
          scenarioMetadata: { sourceCommit: commit },
          app: { peakMemoryMB: peak, averageRendererMemoryMB: peak / 2, averageCpuPercent: 8 },
          telemetry: { processTelemetryP99MeanMs: 2 },
          eventLoop: { p99MeanMs: 35 },
          renderer: { trackMapAnimationFrameP99MeanMs: 2, framesOver50MsPercent: 0 },
        }) as never;
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
      const summary = (runId: string, commit: string, peak: number) =>
        ({
          runId,
          scenarioMetadata: { sourceCommit: commit },
          app: { peakMemoryMB: peak, averageRendererMemoryMB: peak / 2, averageCpuPercent: 8 },
          telemetry: { processTelemetryP99MeanMs: 2 },
          eventLoop: { p99MeanMs: 35 },
          renderer: { trackMapAnimationFrameP99MeanMs: 2, framesOver50MsPercent: 0 },
        }) as never;
      const first = path.join(directory, 'first.json');
      const second = path.join(directory, 'second.json');
      const third = path.join(directory, 'third.json');
      for (const [file, commit, peak] of [
        [first, 'aaa', 1100],
        [second, 'bbb', 1200],
        [third, 'ccc', 1300],
      ] as const) {
        await writeFile(
          file,
          JSON.stringify({
            baseline: summary(`${commit}-base`, commit, peak),
            candidate: summary(`${commit}-cand`, commit, peak + 10),
          })
        );
      }
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
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects empty or malformed invocations', () => {
    expect(() => parseReportOptions([])).toThrow();
    expect(() =>
      parseReportOptions(['one.json', '--unknown', '1'])
    ).toThrow();
  });
});
