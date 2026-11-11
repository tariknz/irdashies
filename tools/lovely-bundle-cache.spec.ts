import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFreshBundleAgeMs } from './lovely-bundle-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 5);

describe('Lovely bundle freshness', () => {
  let directory: string;
  let bundleFile: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'lovely-bundle-cache-'));
    bundleFile = path.join(directory, 'bundle.json');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('refreshes stale data even when checkout gives the file a recent mtime', async () => {
    await writeFile(
      bundleFile,
      JSON.stringify({ timestamp: NOW - 30 * DAY_MS })
    );
    await utimes(bundleFile, new Date(NOW), new Date(NOW));

    expect(await getFreshBundleAgeMs(bundleFile, NOW)).toBeNull();
  });

  it('keeps fresh data even when the file has an old mtime', async () => {
    await writeFile(bundleFile, JSON.stringify({ timestamp: NOW - DAY_MS }));
    const oldMtime = new Date(NOW - 30 * DAY_MS);
    await utimes(bundleFile, oldMtime, oldMtime);

    expect(await getFreshBundleAgeMs(bundleFile, NOW)).toBe(DAY_MS);
  });

  it.each([
    [0, 0],
    [7 * DAY_MS - 1, 7 * DAY_MS - 1],
    [7 * DAY_MS, null],
  ])('handles a bundle age of %s ms', async (age, expected) => {
    await writeFile(bundleFile, JSON.stringify({ timestamp: NOW - age }));

    expect(await getFreshBundleAgeMs(bundleFile, NOW)).toBe(expected);
  });

  it('refreshes a missing bundle', async () => {
    expect(await getFreshBundleAgeMs(bundleFile, NOW)).toBeNull();
  });

  it.each([
    ['malformed JSON', '{'],
    ['null', 'null'],
    ['missing timestamp', '{}'],
    ['string timestamp', JSON.stringify({ timestamp: String(NOW) })],
    ['zero timestamp', '{"timestamp":0}'],
    ['negative timestamp', '{"timestamp":-1}'],
    ['non-finite timestamp', '{"timestamp":1e999}'],
    ['future timestamp', JSON.stringify({ timestamp: NOW + DAY_MS })],
  ])('refreshes a bundle with %s', async (_label, contents) => {
    await writeFile(bundleFile, contents);

    expect(await getFreshBundleAgeMs(bundleFile, NOW)).toBeNull();
  });
});
