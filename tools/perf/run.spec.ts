import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('performance runner window-mode validation', () => {
  it.each([
    ['--window-mode'],
    ['--window-mode', '--target', 'dev'],
    ['--window-mode', 'invalid'],
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
    expect(result.stderr).toContain('--window-mode must be display or widget');
    expect(result.stdout).not.toContain('Performance run:');
  });
});
