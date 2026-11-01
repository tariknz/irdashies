import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TrackDrawing } from '../src/frontend/domain/track/trackDrawing';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const tsxImport = pathToFileURL(require.resolve('tsx')).href;
const repo = process.cwd();
const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
const basePath = 'M0,0L100,0L100,100L0,100Z';
let directory: string;
let drawings: Record<string, TrackDrawing>;
let poleSides: {
  tracks: Record<string, unknown>;
  trackNames: Record<string, unknown>;
};
const verified = {
  poleLeft: true,
  source: 'verified',
  name: 'Manual verified track',
};
const reported = {
  poleLeft: false,
  source: 'reported',
  name: 'Manual reported track',
};
const trackNames = { 'manual track': true };

beforeAll(async () => {
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-track-generator-')
  );
  const assetDirectory = path.join(directory, 'asset-data');
  await fs.mkdir(assetDirectory);
  const ids = [1, 219, 242, 599];
  await fs.writeFile(
    path.join(assetDirectory, 'track-info.json'),
    JSON.stringify(
      ids.map((track_id) => ({
        track_id,
        track_name: `Track ${track_id}`,
        config_name: 'Test',
      }))
    )
  );
  for (const id of ids) {
    const track = path.join(assetDirectory, String(id));
    await fs.mkdir(track);
    await fs.writeFile(
      path.join(track, 'active.svg'),
      svg(`<path d="${basePath}"/>`)
    );
    await fs.writeFile(
      path.join(track, 'turns.svg'),
      svg('<text transform="translate(10 20)">Downloaded label</text>')
    );
    await fs.writeFile(
      path.join(track, 'start-finish.svg'),
      svg('<line x1="0" y1="-5" x2="0" y2="5"/><path d="M0,0L1,1"/>')
    );
  }
  // Use actual checked-in overrides, with deliberately different downloaded SVGs.
  for (const [id, file] of [
    [242, 'active.svg'],
    [599, 'turns.svg'],
    [219, 'start-point.json'],
  ] as const) {
    const overrides = path.join(
      directory,
      'tools/tracks/overrides',
      String(id)
    );
    await fs.mkdir(overrides, { recursive: true });
    await fs.copyFile(
      path.join(repo, 'tools/tracks/overrides', String(id), file),
      path.join(overrides, file)
    );
  }
  // Invoke the real entry point in an isolated working directory. It also runs
  // analyzeTracks, so a surviving monolithic-file dependency fails this test.
  await run(
    process.execPath,
    ['--import', tsxImport, path.join(repo, 'tools/generate-track-json.ts')],
    { cwd: directory }
  );
  const output = path.join(directory, 'src/frontend/domain/track/tracks/by-id');
  drawings = Object.fromEntries(
    await Promise.all(
      ids.map(
        async (id) =>
          [
            String(id),
            JSON.parse(
              await fs.readFile(path.join(output, `${id}.json`), 'utf8')
            ) as TrackDrawing,
          ] as const
      )
    )
  );

  const types = path.join(directory, 'src/types');
  await fs.mkdir(types, { recursive: true });
  const poleFile = path.join(types, 'radarPoleSides.json');
  await fs.writeFile(
    poleFile,
    JSON.stringify({
      version: 1,
      tracks: { 219: verified, 999999: reported },
      trackNames,
    })
  );
  await run(
    process.execPath,
    [
      '--import',
      tsxImport,
      path.join(repo, 'tools/generate-radar-pole-sides.ts'),
    ],
    { cwd: directory }
  );
  poleSides = JSON.parse(await fs.readFile(poleFile, 'utf8'));
}, 20_000);

afterAll(async () => {
  if (
    !directory?.startsWith(path.join(os.tmpdir(), 'irdashies-track-generator-'))
  ) {
    throw new Error('Unexpected generator test directory');
  }
  await fs.rm(directory, { recursive: true, force: true });
});

describe('track-generation entry points', () => {
  it('writes only the per-track source files and analyzes them without a monolith', async () => {
    const tracks = path.join(directory, 'src/frontend/domain/track/tracks');
    expect(await fs.readdir(tracks)).toEqual(['by-id']);
    expect((await fs.readdir(path.join(tracks, 'by-id'))).sort()).toEqual([
      '1.json',
      '219.json',
      '242.json',
      '599.json',
    ]);
    expect(drawings['1'].active.inside).toBe(basePath);
    expect(drawings['1'].active.totalLength).toBe(400);
  });

  it('uses an active SVG override instead of the downloaded path', () => {
    expect(drawings['242'].active.inside).not.toBe(basePath);
    expect(drawings['242'].active.totalLength).toBeGreaterThan(400);
    expect(
      drawings['242'].active.trackPathPoints?.some((point) => point.x > 100)
    ).toBe(true);
  });

  it('uses the checked-in turn-label SVG override', () => {
    expect(drawings['599'].turns).toContainEqual({
      x: 1316.52,
      y: 796.82,
      content: '4',
    });
    expect(
      drawings['599'].turns?.some((turn) => turn.content === 'Downloaded label')
    ).toBe(false);
  });

  it('applies manual start-point coordinates and direction corrections', () => {
    expect(drawings['219'].startFinish.point).toMatchObject({
      x: 1816,
      y: 820,
    });
    expect(Number.isFinite(drawings['219'].startFinish.point?.length)).toBe(
      true
    );
    expect(drawings['219'].startFinish.direction).toBe('anticlockwise');
  });

  it('preserves verified, reported and track-name pole-side overrides', () => {
    expect(poleSides.tracks['219']).toEqual(verified);
    expect(poleSides.tracks['999999']).toEqual(reported);
    expect(poleSides.trackNames).toEqual(trackNames);
  });
});
