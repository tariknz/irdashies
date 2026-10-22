import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));
import {
  createReleaseNotesStore,
  defaultReleaseNotesState,
  sanitizeRelease,
} from './releaseNotes';
import { releaseNotesFixture } from '../../types/releaseNotesFixture';
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});
async function target() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'irdashies-notes-'));
  dirs.push(dir);
  return path.join(dir, 'release-notes.json');
}

describe('release notes persistence', () => {
  it('returns safe defaults for missing/corrupt files and validates persisted shapes', async () => {
    const file = await target();
    expect(await createReleaseNotesStore(file).load()).toEqual(
      defaultReleaseNotesState()
    );
    await writeFile(file, '{bad');
    expect(await createReleaseNotesStore(file).load()).toEqual(
      defaultReleaseNotesState()
    );
    await writeFile(
      file,
      JSON.stringify({
        lastVersion: '../x',
        pendingVersion: 42,
        autoShow: 'yes',
        cache: [
          { body: '<script>' },
          { ...releaseNotesFixture(), url: 'https://example.com' },
        ],
      })
    );
    expect(await createReleaseNotesStore(file).load()).toEqual(
      defaultReleaseNotesState()
    );
  });
  it('flushes debounced changes and restores global preference/dismissal on restart', async () => {
    const file = await target();
    const store = createReleaseNotesStore(file);
    await store.load();
    store.save({
      ...defaultReleaseNotesState(),
      lastVersion: '2.1.0',
      unreadVersion: '2.1.0',
      autoShow: false,
    });
    await store.flush();
    expect(await createReleaseNotesStore(file).load()).toMatchObject({
      lastVersion: '2.1.0',
      unreadVersion: '2.1.0',
      autoShow: false,
      pendingVersion: null,
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      autoShow: false,
    });
  });
  it('caps cache at five and can read its worst-case Unicode output', async () => {
    const file = await target();
    const store = createReleaseNotesStore(file);
    await store.load();
    store.save({
      ...defaultReleaseNotesState(),
      cache: Array.from({ length: 8 }, (_, i) => ({
        ...releaseNotesFixture(`2.${i}.0`),
        body: '漢'.repeat(200_000),
      })),
    });
    await store.flush();
    expect((await createReleaseNotesStore(file).load()).cache).toHaveLength(5);
  });
  it('rejects forged or malformed release links and oversized content', () => {
    expect(
      sanitizeRelease({
        ...releaseNotesFixture(),
        url: 'https://github.com/tariknz/irdashies/releases/tag/v9.9.9',
      })
    ).toBeNull();
    expect(
      sanitizeRelease({ ...releaseNotesFixture(), body: 'x'.repeat(200_001) })
    ).toBeNull();
  });
});
