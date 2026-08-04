import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  telemetryStateProbe,
  validateReplay,
  type ReplayMetadata,
} from './validator';

const TAPE_PATH = path.resolve('test-data/telemetry/ai-race-10min.irdt');
const METADATA_PATH = path.resolve('test-data/telemetry/ai-race-10min.json');
const GOLDEN_PATH = path.resolve(
  'test-data/telemetry/ai-race-10min.golden.json'
);

interface CuratedMetadata extends ReplayMetadata {
  description: string;
  captureDate: string;
  durationSeconds: number;
  fileBytes: number;
}

async function assertTapeAvailable(expectedBytes: number): Promise<void> {
  let tapeStat;
  try {
    tapeStat = await stat(TAPE_PATH);
  } catch {
    throw new Error(
      `Curated telemetry tape is missing. Run: git lfs pull --include="${path.relative(
        process.cwd(),
        TAPE_PATH
      )}"`
    );
  }
  if (tapeStat.size !== expectedBytes) {
    const prefix = await readFile(TAPE_PATH, { encoding: 'utf8' }).then(
      (value) => value.slice(0, 80),
      () => ''
    );
    if (prefix.startsWith('version https://git-lfs.github.com/spec/v1')) {
      throw new Error(
        `Curated telemetry tape is a Git LFS pointer. Run: git lfs pull --include="${path.relative(
          process.cwd(),
          TAPE_PATH
        )}"`
      );
    }
    throw new Error(
      `Curated telemetry tape size mismatch: expected=${expectedBytes}, actual=${tapeStat.size}`
    );
  }
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update');
  const metadata = JSON.parse(
    await readFile(METADATA_PATH, 'utf8')
  ) as CuratedMetadata;
  await assertTapeAvailable(metadata.fileBytes);

  const started = performance.now();
  const result = await validateReplay({
    path: TAPE_PATH,
    expected: {
      sha256: metadata.sha256,
      formatVersion: metadata.formatVersion,
      sdkVersion: metadata.sdkVersion,
      tickRateHz: metadata.tickRateHz,
      variableCount: metadata.variableCount,
      frameBytes: metadata.frameBytes,
      mappingBytes: metadata.mappingBytes,
      recordCount: metadata.recordCount,
      frameCount: metadata.frameCount,
      sessionUpdateCount: metadata.sessionUpdateCount,
      gapCount: metadata.gapCount,
    },
    probes: [telemetryStateProbe],
  });
  const golden = {
    tapeSha256: result.metadata.sha256,
    sessionPollMilliseconds: 500,
    appliedSessionUpdateCount: result.appliedSessionUpdateCount,
    probes: result.probes,
  };

  if (update) {
    await writeFile(
      GOLDEN_PATH,
      `${JSON.stringify(golden, null, 2)}\n`,
      'utf8'
    );
    process.stdout.write(
      `Updated ${path.relative(process.cwd(), GOLDEN_PATH)}\n`
    );
  } else {
    const expectedGolden = JSON.parse(await readFile(GOLDEN_PATH, 'utf8'));
    if (JSON.stringify(golden) !== JSON.stringify(expectedGolden)) {
      const actualProbe = golden.probes[0];
      const expectedProbe = expectedGolden.probes?.[0];
      throw new Error(
        `Replay state mismatch for ${actualProbe.name}: expected=${String(
          expectedProbe?.rollingHash
        )}, actual=${actualProbe.rollingHash}, lastState=${JSON.stringify(
          actualProbe.checkpoints.lastFrame
        )}. Run npm run test:replay:curated:update only after reviewing the change.`
      );
    }
  }

  process.stdout.write(
    `Validated ${result.metadata.frameCount} frames, ${result.metadata.sessionUpdateCount} session revisions, and ${result.probes.length} probe in ${(
      (performance.now() - started) /
      1000
    ).toFixed(2)}s.\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
