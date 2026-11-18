import { describe, expect, it } from 'vitest';
import {
  choiceArgument,
  listArgument,
  numericArgument,
  parseArguments,
} from './args';

describe('perf CLI argument parsing', () => {
  it('parses value flags, inline values, booleans and positionals', () => {
    const parsed = parseArguments(
      ['input.log', '--warmup-seconds=30', '--baseline', 'base.log', '--strict'],
      {
        usage: 'usage',
        values: ['--warmup-seconds', '--baseline'],
        booleans: ['--strict'],
        positional: 'one',
      }
    );

    expect(parsed.positionals).toEqual(['input.log']);
    expect(parsed.value('--warmup-seconds')).toBe('30');
    expect(parsed.flag('--strict')).toBe(true);
    expect(numericArgument(parsed, '--warmup-seconds', 0, { min: 1 })).toBe(30);
    expect(listArgument(parsed, '--baseline')).toEqual(['base.log']);
  });

  it.each([
    [['--unknown', '1']],
    [['--input', 'a.irdt', '--input', 'b.irdt']],
    [['--input']],
    [['--input', '--output', 'x']],
    [['a.log', 'b.log']],
    [['--flag=value']],
  ])('rejects malformed arguments %j', (args) => {
    expect(() =>
      parseArguments(args as string[], {
        usage: 'usage',
        values: ['--input', '--output'],
        booleans: ['--flag'],
        positional: 'one',
      })
    ).toThrow();
  });

  it('validates numeric and enum values instead of silently defaulting', () => {
    const parsed = parseArguments(['--mode', 'full', '--count', '12'], {
      usage: 'usage',
      values: ['--mode', '--count'],
    });

    expect(choiceArgument(parsed, '--mode', ['empty', 'full'], 'full')).toBe(
      'full'
    );
    expect(numericArgument(parsed, '--count', 0, { min: 10 })).toBe(12);
    expect(() =>
      numericArgument(parsed, '--count', 0, { min: 20 })
    ).toThrow(/Invalid --count/);
    expect(() =>
      choiceArgument(parsed, '--mode', ['empty', 'observer'], 'empty')
    ).toThrow(/Invalid --mode/);
  });
});
