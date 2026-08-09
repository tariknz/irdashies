import { open, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  telemetryStateProbe,
  validateReplay,
  type ReplayMetadata,
  type ReplayProbeResult,
} from './validator';
import { createFuelStateProbe } from './fuel-probe';
import { createLapTimesProbe } from './lap-times-probe';
import { createCarSpeedsProbe } from './car-speeds-probe';
import { createReferenceLapsProbe } from './reference-laps-probe';
import { createRelativeGapsProbe } from './relative-gaps-probe';
import { createSectorTimingProbe } from './sector-timing-probe';
import { createStandingsProbe } from './standings-probe';
import { createRadioProbe } from './radio-probe';
import { createSessionTimingProbe } from './session-timing-probe';
import { createSessionBarProbe } from './session-bar-probe';
import { createDriverControlsProbe } from './driver-controls-probe';
import { createTrackStateProbe } from './track-state-probe';
import { createLapLogProbe } from './lap-log-probe';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const TAPE_PATH = path.join(
  REPOSITORY_ROOT,
  'test-data/telemetry/ai-race-10min.irdt'
);
const METADATA_PATH = path.join(
  REPOSITORY_ROOT,
  'test-data/telemetry/ai-race-10min.json'
);
const GOLDEN_PATH = path.join(
  REPOSITORY_ROOT,
  'test-data/telemetry/ai-race-10min.golden.json'
);

interface CuratedMetadata extends ReplayMetadata {
  description: string;
  captureDate: string;
  durationSeconds: number;
  fileBytes: number;
}

interface CuratedGolden {
  tapeSha256: string;
  sessionPollMilliseconds: number;
  appliedSessionUpdateCount: number;
  disconnectCount: number;
  endCount: number;
  probes: ReplayProbeResult[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReplayProbeResult = (value: unknown): value is ReplayProbeResult =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.schemaVersion === 'number' &&
  typeof value.frameCount === 'number' &&
  typeof value.rollingHash === 'string' &&
  isRecord(value.checkpoints);

const isCuratedGolden = (value: unknown): value is CuratedGolden =>
  isRecord(value) &&
  typeof value.tapeSha256 === 'string' &&
  typeof value.sessionPollMilliseconds === 'number' &&
  typeof value.appliedSessionUpdateCount === 'number' &&
  typeof value.disconnectCount === 'number' &&
  typeof value.endCount === 'number' &&
  Array.isArray(value.probes) &&
  value.probes.every(isReplayProbeResult);

async function readPrefix(filePath: string, length: number): Promise<string> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function assertTapeAvailable(expectedBytes: number): Promise<void> {
  let tapeStat;
  try {
    tapeStat = await stat(TAPE_PATH);
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== 'ENOENT') {
      throw error;
    }
    throw new Error(
      `Curated telemetry tape is missing. Run: git lfs pull --include="${path.relative(
        REPOSITORY_ROOT,
        TAPE_PATH
      )}"`,
      { cause: error }
    );
  }
  if (tapeStat.size !== expectedBytes) {
    const prefix = await readPrefix(TAPE_PATH, 80).catch(() => '');
    if (prefix.startsWith('version https://git-lfs.github.com/spec/v1')) {
      throw new Error(
        `Curated telemetry tape is a Git LFS pointer. Run: git lfs pull --include="${path.relative(
          REPOSITORY_ROOT,
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
    probes: [
      telemetryStateProbe,
      createFuelStateProbe(),
      createLapTimesProbe(),
      createCarSpeedsProbe(),
      createReferenceLapsProbe(),
      createRelativeGapsProbe(),
      createSectorTimingProbe(),
      createStandingsProbe(),
      createRadioProbe(),
      createSessionTimingProbe(),
      createSessionBarProbe(),
      createDriverControlsProbe(),
      createTrackStateProbe(),
      createLapLogProbe(),
    ],
  });
  const golden = {
    tapeSha256: result.metadata.sha256,
    sessionPollMilliseconds: 500,
    appliedSessionUpdateCount: result.appliedSessionUpdateCount,
    disconnectCount: result.disconnectCount,
    endCount: result.endCount,
    probes: result.probes,
  } satisfies CuratedGolden;

  if (update) {
    await writeFile(
      GOLDEN_PATH,
      `${JSON.stringify(golden, null, 2)}\n`,
      'utf8'
    );
    process.stdout.write(
      `Updated ${path.relative(REPOSITORY_ROOT, GOLDEN_PATH)}\n`
    );
  } else {
    const goldenText = await readFile(GOLDEN_PATH, 'utf8').catch(
      (error: unknown) => {
        if (isRecord(error) && error.code === 'ENOENT') {
          throw new Error(
            `Curated golden is missing at ${path.relative(
              REPOSITORY_ROOT,
              GOLDEN_PATH
            )}. Run: npm run test:replay:curated:update`
          );
        }
        throw error;
      }
    );
    const parsedGolden: unknown = JSON.parse(goldenText);
    if (!isCuratedGolden(parsedGolden)) {
      throw new Error(
        `Curated golden has an invalid shape. Run: npm run test:replay:curated:update`
      );
    }
    const expectedGolden = parsedGolden;
    if (JSON.stringify(golden) !== JSON.stringify(expectedGolden)) {
      const actualProbe =
        golden.probes.find(
          (probe, index) =>
            JSON.stringify(probe) !==
            JSON.stringify(expectedGolden.probes[index])
        ) ?? golden.probes[0];
      const expectedProbe = expectedGolden.probes.find(
        (probe) => probe.name === actualProbe.name
      );
      const changedField = (
        Object.keys(golden) as (keyof CuratedGolden)[]
      ).find(
        (key) =>
          JSON.stringify(golden[key]) !== JSON.stringify(expectedGolden[key])
      );
      const checkpoint = Object.keys(actualProbe.checkpoints).find(
        (key) =>
          JSON.stringify(actualProbe.checkpoints[key]) !==
          JSON.stringify(expectedProbe?.checkpoints[key])
      );
      throw new Error(
        `Replay state mismatch in ${String(changedField)} for ${actualProbe.name}` +
          `${checkpoint ? ` at checkpoint ${checkpoint}` : ''}: expected=${String(
            expectedProbe?.rollingHash
          )}, actual=${actualProbe.rollingHash}, lastState=${JSON.stringify(
            actualProbe.checkpoints.lastFrame
          )}. Run npm run test:replay:curated:update only after reviewing the change.`
      );
    }
  }

  process.stdout.write(
    `Validated ${result.metadata.frameCount} frames, ${result.metadata.sessionUpdateCount} session revisions, ${result.disconnectCount} disconnects, and ${result.probes.length} probe${result.probes.length === 1 ? '' : 's'} in ${(
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
