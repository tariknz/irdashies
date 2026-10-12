// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TOOL_DIR = path.join(ROOT, 'tools/telemetry-replay');
const TSX_CLI = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');

// Everything run-curated-validation.ts loads, without running it (it needs the
// LFS tape, which CI doesn't fetch).
const modules = readdirSync(TOOL_DIR)
  .filter((name) => /^(validator|.*-probe)\.ts$/.test(name))
  .map((name) => path.join(TOOL_DIR, name));

describe('telemetry replay tooling', () => {
  // `npm run test:replay:curated` runs under tsx, without Vite. A runtime
  // import of the @irdashies/types barrel reaches import.meta.glob and throws.
  it('loads its modules under plain Node (tsx)', () => {
    expect(modules.length).toBeGreaterThan(5);
    const imports = modules
      // A file URL, since Windows absolute paths aren't valid import specifiers.
      .map(
        (file) => `await import(${JSON.stringify(pathToFileURL(file).href)});`
      )
      .join('');
    // tsx --eval compiles to CommonJS, which has no top-level await.
    const script = `(async () => {${imports}})().catch((error) => {
      process.stderr.write(String(error?.stack ?? error));
      process.exit(1);
    });`;
    const result = spawnSync(process.execPath, [TSX_CLI, '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  }, 60_000);
});
