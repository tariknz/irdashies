// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tsx = createRequire(path.resolve('package.json')).resolve('tsx/cli');

function runTool(name: string) {
  const result = spawnSync(
    process.execPath,
    [tsx, path.resolve('tools/telemetry-replay', name)],
    { encoding: 'utf8', timeout: 90_000 }
  );
  expect(result.error).toBeUndefined();
  return result;
}

describe('telemetry replay commands under Node', () => {
  it('runs curated validation or identifies the missing LFS recording', () => {
    const { status, stdout, stderr } = runTool('run-curated-validation.ts');
    if (status === 0) {
      expect(stdout).toMatch(/Validated \d+ frames/);
    } else {
      expect(status).toBe(1);
      expect(stderr).toMatch(
        /Curated telemetry tape is (missing|a Git LFS pointer)/
      );
    }
  }, 100_000);

  it('prints the car systems report usage when no tape is supplied', () => {
    const { status, stderr, stdout } = runTool('car-systems-report.ts');
    expect(status).toBe(1);
    expect(stderr + stdout).toContain('--input <tape.irdt>');
  });
});
