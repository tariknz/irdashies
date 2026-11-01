import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readTrackDrawings, writeTrackDrawings } from './track-drawings';
import type { TrackDrawing } from '../src/frontend/domain/track/trackDrawing';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'irdashies-track-source-')
  );
});
afterEach(async () => {
  if (
    !directory.startsWith(path.join(os.tmpdir(), 'irdashies-track-source-'))
  ) {
    throw new Error('Unexpected test directory');
  }
  await fs.rm(directory, { recursive: true, force: true });
});

const drawing: TrackDrawing = {
  active: {
    inside: 'M0 0',
    outside: '',
    trackPathPoints: [{ x: 1.25, y: 4.75 }],
  },
  startFinish: {},
};

describe('track source files', () => {
  it('round trips readable per-track files without changing coordinate precision', async () => {
    await writeTrackDrawings({ 1: drawing, 2: drawing }, directory);
    await fs.writeFile(path.join(directory, 'LICENSE'), 'Track data license');
    expect(await readTrackDrawings(directory)).toEqual({
      1: drawing,
      2: drawing,
    });
    expect(await fs.readFile(path.join(directory, '1.json'), 'utf8')).toBe(
      `${JSON.stringify(drawing, null, 2)}\n`
    );
  });

  it('preserves unchanged files and removes deleted IDs without touching other files', async () => {
    await writeTrackDrawings({ 1: drawing, 2: drawing }, directory);
    await fs.writeFile(path.join(directory, 'LICENSE'), 'Track data license');
    const modified = (await fs.stat(path.join(directory, '1.json'))).mtimeMs;
    await writeTrackDrawings({ 1: drawing, 2: undefined }, directory);
    expect((await fs.stat(path.join(directory, '1.json'))).mtimeMs).toBe(
      modified
    );
    expect((await fs.readdir(directory)).sort()).toEqual(['1.json', 'LICENSE']);
  });

  it('rejects invalid IDs before writing source files', async () => {
    await expect(
      writeTrackDrawings({ '../outside': drawing }, directory)
    ).rejects.toThrow('numeric track IDs');
    expect(await fs.readdir(directory)).toEqual([]);
  });
});
