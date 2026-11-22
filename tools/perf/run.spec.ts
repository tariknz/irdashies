import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('performance runner window-mode validation', () => {
  it.each([
    ['--window-mode'],
    ['--window-mode', '--target', 'dev'],
    ['--window-mode', 'invalid'],
    ['--window-mode=invalid'],
  ])('rejects invalid arguments %j before launching the app', (...args) => {
    const result = spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        resolve('tools/perf/run.ts'),
        ...args,
      ],
      { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /(?:Invalid --window-mode|--window-mode requires a value)/
    );
    expect(result.stdout).not.toContain('Performance run:');
  });

  it.each([
    ['--replay-speed', '200'],
    ['--replay-speed', 'abc'],
    ['--sdk-wait', '--unknown', '1'],
  ])('rejects %j before launching the app', (...args) => {
    const result = spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        resolve('tools/perf/run.ts'),
        ...args,
      ],
      { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }
    );
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('Performance run:');
  });
});
