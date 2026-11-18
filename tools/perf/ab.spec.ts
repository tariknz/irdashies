import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAbOptions } from './ab';

describe('performance CLI A/B runner', () => {
  it('resolves the recording, scenarios and output directory', () => {
    expect(
      parseAbOptions([
        '--input',
        'session.irdt',
        '--duration-seconds',
        '420',
        '--warmup-seconds',
        '60',
        '--scenarios',
        'observer,full',
        '--output',
        'ab-run',
      ])
    ).toMatchObject({
      inputPath: path.resolve('session.irdt'),
      durationSeconds: 420,
      warmupSeconds: 60,
      scenarios: ['observer', 'full'],
      outputDirectory: path.resolve('ab-run'),
    });
  });

  it('rejects unusable experiment definitions', () => {
    expect(() => parseAbOptions([])).toThrow(/--input is required/);
    expect(() =>
      parseAbOptions([
        '--input',
        'session.irdt',
        '--duration-seconds',
        '120',
        '--warmup-seconds',
        '200',
      ])
    ).toThrow(/Invalid A\/B option/);
    expect(() =>
      parseAbOptions(['--input', 'session.irdt', '--scenarios', 'full'])
    ).toThrow(/At least two scenarios/);
  });
});
