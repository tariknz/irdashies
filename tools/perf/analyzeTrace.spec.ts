import { describe, expect, it } from 'vitest';
import {
  analyzeTraceJson,
  parseTraceAnalysisOptions,
  traceAnalysisMarkdown,
} from './analyzeTrace';

const trace = {
  traceEvents: [
    {
      name: 'ProfileChunk',
      ph: 'I',
      args: {
        data: {
          cpuProfile: {
            nodes: [
              {
                id: 1,
                callFrame: {
                  functionName: 'expensiveDraw',
                  url: 'webpack://src/widget.ts',
                  lineNumber: 9,
                },
              },
            ],
            samples: [1, 1],
          },
          timeDeltas: [1000, 2000],
        },
      },
    },
    {
      name: 'RunTask',
      ph: 'X',
      ts: 1_000_000,
      dur: 120_000,
      pid: 7,
      tid: 8,
    },
    { name: 'MajorGC', ph: 'X', ts: 900_000, dur: 10_000, pid: 7, tid: 8 },
    {
      name: 'CpuProfiler::StartProfiling',
      ph: 'X',
      ts: 0,
      dur: 250_000,
      pid: 7,
      tid: 8,
    },
  ],
};

describe('trace analysis', () => {
  it('summarizes V8 self time, long tasks and GC without trace startup noise', () => {
    const analysis = analyzeTraceJson(trace, 'trace.json');

    expect(analysis.profile.sampleCount).toBe(2);
    expect(analysis.profile.sampledMs).toBe(3);
    expect(analysis.profile.hotspots[0]).toMatchObject({
      functionName: 'expensiveDraw',
      selfMs: 3,
      samples: 2,
      location: 'webpack://src/widget.ts:10',
    });
    expect(analysis.longTasks.count).toBe(1);
    expect(analysis.longTasks.worstMs).toBe(120);
    expect(analysis.gc).toMatchObject({ count: 1, totalMs: 10, maxMs: 10 });
    expect(analysis.processes[0]).toMatchObject({ pid: 7, longTasks: 1 });
    expect(analysis.limitations.join(' ')).toContain('overhead');
    expect(traceAnalysisMarkdown(analysis)).toContain('expensiveDraw');
  });

  it('scopes nodes to the process, thread and profile, including node-only chunks', () => {
    const nodes = (
      pid: number,
      tid: number,
      id: string,
      functionName: string
    ) => ({
      name: 'ProfileChunk',
      pid,
      tid,
      id,
      args: {
        data: {
          cpuProfile: { nodes: [{ id: 1, callFrame: { functionName } }] },
        },
      },
    });
    const sample = (pid: number, tid: number, id: string, delta: number) => ({
      name: 'ProfileChunk',
      pid,
      tid,
      id,
      args: { data: { cpuProfile: { samples: [1] }, timeDeltas: [delta] } },
    });
    const { profile } = analyzeTraceJson(
      [
        nodes(1, 2, '0x1', 'main'),
        sample(1, 2, '0x1', 100),
        nodes(2, 2, '0x1', 'renderer'),
        sample(2, 2, '0x1', 200),
        nodes(1, 3, '0x1', 'worker'),
        sample(1, 3, '0x1', 300),
        nodes(1, 2, '0x2', 'anotherProfile'),
        sample(1, 2, '0x2', 400),
      ],
      'trace.json'
    );
    expect(profile.sampledMs).toBe(1);
    expect(
      profile.hotspots.map(({ functionName, selfMs }) => [functionName, selfMs])
    ).toEqual([
      ['anotherProfile', 0.4],
      ['worker', 0.3],
      ['renderer', 0.2],
      ['main', 0.1],
    ]);
  });

  it('accepts a raw event array and rejects unusable traces', () => {
    expect(analyzeTraceJson(trace.traceEvents, 'trace.json').eventCount).toBe(
      4
    );
    expect(() => analyzeTraceJson({ traceEvents: [] }, 'empty.json')).toThrow(
      /No traceEvents/
    );
  });

  it('parses strict CLI options', () => {
    expect(
      parseTraceAnalysisOptions([
        'trace.json',
        '--output',
        'summary',
        '--min-long-task-ms',
        '80',
      ])
    ).toMatchObject({
      inputPath: expect.stringMatching(/trace\.json$/),
      outputPrefix: expect.stringMatching(/summary$/),
      minLongTaskMs: 80,
    });
    expect(() =>
      parseTraceAnalysisOptions(['trace.json', '--unknown', '1'])
    ).toThrow();
  });
});
