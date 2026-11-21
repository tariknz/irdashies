import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTraceOptions } from './trace';

describe('performance CLI trace', () => {
  it('resolves the recording and trace file paths', () => {
    expect(
      parseTraceOptions([
        '--input',
        'session.irdt',
        '--duration-seconds',
        '30',
        '--output',
        'trace.json',
        '--port',
        '9333',
      ])
    ).toMatchObject({
      inputPath: path.resolve('session.irdt'),
      durationSeconds: 30,
      outputPath: path.resolve('trace.json'),
      port: 9333,
      speed: 1,
    });
  });

  it('rejects options that cannot produce a usable trace', () => {
    expect(() => parseTraceOptions([])).toThrow(/--input is required/);
    expect(() =>
      parseTraceOptions(['--input', 'session.irdt', '--duration-seconds', '1'])
    ).toThrow(/Invalid trace option/);
    expect(() =>
      parseTraceOptions(['--input', 'session.irdt', '--port', '80'])
    ).toThrow(/Invalid trace option/);
  });
});
