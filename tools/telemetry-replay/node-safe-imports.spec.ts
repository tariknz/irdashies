// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TOOL_DIR = path.join(ROOT, 'tools/telemetry-replay');
const TSX_CLI = createRequire(path.join(ROOT, 'package.json')).resolve(
  'tsx/cli'
);

// Scripts run with tsx that start working as soon as they load (they need the
// LFS tape, which CI doesn't fetch), so the spec loads what they import.
const RUNNERS = ['run-curated-validation.ts', 'car-systems-report.ts'];

const specifiersOf = (file: string) =>
  [
    ...readFileSync(path.join(TOOL_DIR, file), 'utf8').matchAll(
      /from ['"]([^'"]+)['"]/g
    ),
  ].map(([, specifier]) => specifier);

const runnerDependencies = RUNNERS.flatMap((runner) =>
  specifiersOf(runner)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => path.resolve(TOOL_DIR, `${specifier}.ts`))
);

const modules = [
  ...new Set([
    ...readdirSync(TOOL_DIR)
      .filter((name) => /^(validator|.*-probe)\.ts$/.test(name))
      .map((name) => path.join(TOOL_DIR, name)),
    ...runnerDependencies,
  ]),
];

describe('telemetry replay tooling', () => {
  // `npm run test:replay:curated` runs under tsx, without Vite. A runtime
  // import of the @irdashies/types barrel reaches import.meta.glob and throws.
  it('loads its modules under plain Node (tsx)', () => {
    expect(modules.length).toBeGreaterThan(5);
    // Keep module paths as data, never interpolate them into executable code.
    // tsx --eval compiles to CommonJS, which has no top-level await.
    const script = `(async () => {
      for (const file of process.argv.slice(1)) await import(file);
    })().catch((error) => {
      process.stderr.write(String(error?.stack ?? error));
      process.exit(1);
    });`;
    const result = spawnSync(
      process.execPath,
      [
        TSX_CLI,
        '--eval',
        script,
        ...modules.map((file) => pathToFileURL(file).href),
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  }, 60_000);

  // The runners aren't loaded above, so they must reach app code only through
  // the modules that are.
  it.each(RUNNERS)('%s imports no @irdashies alias directly', (runner) => {
    expect(
      specifiersOf(runner).filter((specifier) =>
        specifier.startsWith('@irdashies')
      )
    ).toEqual([]);
  });
});
