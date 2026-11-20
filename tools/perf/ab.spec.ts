import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  contrastBetween,
  parseAbOptions,
  parseScenarioSpecs,
} from './ab';

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

  it('maps widget scenarios to a full dashboard with a widget filter', () => {
    const specs = parseScenarioSpecs(['observer', 'full', 'map']);

    expect(specs).toEqual([
      { name: 'observer', mode: 'observer' },
      { name: 'full', mode: 'full' },
      { name: 'map', mode: 'full', widgets: 'map' },
    ]);
    expect(parseScenarioSpecs(['widgets:map'])).toEqual([specs[2]]);
    expect(contrastBetween(specs[0], specs[1])).toEqual(['overlay']);
    expect(contrastBetween(specs[1], specs[2])).toEqual(['widgets']);
    expect(() => parseScenarioSpecs(['full', 'bad name'])).toThrow(
      /Invalid scenario/
    );
  });

  it('rejects unusable experiment definitions', () => {
    expect(
      parseAbOptions([
        '--input',
        'session.irdt',
        '--scenarios',
        'observer,full',
        '--ignore-gates',
        'memory,FPS',
      ]).ignoreGates
    ).toEqual(['memory', 'FPS']);
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
