import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseReportOptions } from './report';

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

  it('rejects empty or malformed invocations', () => {
    expect(() => parseReportOptions([])).toThrow();
    expect(() =>
      parseReportOptions(['one.json', '--unknown', '1'])
    ).toThrow();
  });
});
