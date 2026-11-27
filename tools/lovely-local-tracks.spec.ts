import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasTrackRecords,
  mergeLocalTracks,
  readLocalTracks,
} from './lovely-local-tracks';

describe('local Lovely tracks', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'lovely-local-tracks-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads every JSON track in the folder, in file name order', async () => {
    await writeFile(
      path.join(directory, 'b.json'),
      JSON.stringify({ trackId: 'second' })
    );
    await writeFile(
      path.join(directory, 'a.json'),
      JSON.stringify({ trackId: 'first' })
    );
    await writeFile(path.join(directory, 'notes.txt'), 'ignored');

    expect(readLocalTracks(directory).map((t) => t.trackId)).toEqual([
      'first',
      'second',
    ]);
  });

  it('reads nothing when the folder does not exist', () => {
    expect(readLocalTracks(path.join(directory, 'missing'))).toEqual([]);
  });

  it('skips a file without a track id', async () => {
    await writeFile(path.join(directory, 'a.json'), JSON.stringify({}));
    await writeFile(path.join(directory, 'b.json'), 'null');

    expect(readLocalTracks(directory)).toEqual([]);
  });

  it('accepts a cached bundle only when its tracks are a record', () => {
    expect(hasTrackRecords({ timestamp: 1, tracks: {} })).toBe(true);
    expect(hasTrackRecords({ timestamp: 1 })).toBe(false);
    expect(hasTrackRecords({ timestamp: 1, tracks: null })).toBe(false);
    expect(hasTrackRecords({ timestamp: 1, tracks: [] })).toBe(false);
    expect(hasTrackRecords(null)).toBe(false);
  });

  it('adds a layout the dataset lacks and keeps the dataset when it has one', () => {
    const tracks: Record<string, { trackId: string; name: string }> = {
      known: { trackId: 'known', name: 'from the dataset' },
    };

    const added = mergeLocalTracks(tracks, [
      { trackId: 'known', name: 'local copy' },
      { trackId: 'missing', name: 'local only' },
    ]);

    expect(added).toEqual(['missing']);
    expect(tracks.known.name).toBe('from the dataset');
    expect(tracks.missing.name).toBe('local only');
  });
});
