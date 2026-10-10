import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import logger from '../logger';
import {
  MAX_KNOWN_LOCAL_USER_IDS,
  createKnownLocalUserIdStore,
  withKnownUserId,
} from './knownLocalUserIds';

const FILE = 'known-local-user-ids.json';
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-known-ids-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true });
});

const readFile = () =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, FILE), 'utf-8')) as {
    knownLocalUserIds: number[];
  };

describe('withKnownUserId', () => {
  it('puts the newest id first without duplicates', () => {
    expect(withKnownUserId([1, 2, 3], 2)).toEqual([2, 1, 3]);
  });

  it('keeps only the newest ten ids', () => {
    const ids = Array.from(
      { length: MAX_KNOWN_LOCAL_USER_IDS },
      (_, i) => i + 1
    );
    const next = withKnownUserId(ids, 99);

    expect(next).toHaveLength(MAX_KNOWN_LOCAL_USER_IDS);
    expect(next[0]).toBe(99);
    expect(next).not.toContain(MAX_KNOWN_LOCAL_USER_IDS);
  });
});

describe('known local user id store', () => {
  it('loads an empty list when no file exists', async () => {
    const store = createKnownLocalUserIdStore(tmpDir);

    expect(await store.load()).toEqual([]);
    expect(store.has(1)).toBe(false);
  });

  it.each(['not json', '{}', '{"knownLocalUserIds":"x"}', 'null'])(
    'falls back to an empty list and warns for %s',
    async (contents) => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      fs.writeFileSync(path.join(tmpDir, FILE), contents);
      const store = createKnownLocalUserIdStore(tmpDir);

      expect(await store.load()).toEqual([]);
      expect(warn).toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(tmpDir);
    }
  );

  it('drops invalid entries from a stored list', async () => {
    fs.writeFileSync(
      path.join(tmpDir, FILE),
      JSON.stringify({ knownLocalUserIds: [5, -1, 'x', 1.5, 5, 7] })
    );
    const store = createKnownLocalUserIdStore(tmpDir);

    expect(await store.load()).toEqual([5, 7]);
  });

  it('remembers an id and writes it after the debounce', async () => {
    const store = createKnownLocalUserIdStore(tmpDir);
    await store.load();

    expect(store.remember(1234)).toBe(true);
    expect(store.has(1234)).toBe(true);
    await store.flush();

    expect(readFile().knownLocalUserIds).toEqual([1234]);
  });

  it('does not rewrite when the newest id is seen again', async () => {
    const store = createKnownLocalUserIdStore(tmpDir);
    await store.load();
    store.remember(1234);

    expect(store.remember(1234)).toBe(false);
  });

  it('ignores ids that are not positive integers', () => {
    const store = createKnownLocalUserIdStore(tmpDir);

    expect(store.remember(0)).toBe(false);
    expect(store.remember(-4)).toBe(false);
    expect(store.remember(1.5)).toBe(false);
  });

  it('merges the stored list before writing, newest first', async () => {
    fs.writeFileSync(
      path.join(tmpDir, FILE),
      JSON.stringify({ knownLocalUserIds: [10, 20] })
    );
    const store = createKnownLocalUserIdStore(tmpDir);

    // Remembered before load was ever called.
    store.remember(30);
    await store.flush();

    expect(readFile().knownLocalUserIds).toEqual([30, 10, 20]);
  });

  it('caps the stored list at ten ids', async () => {
    const store = createKnownLocalUserIdStore(tmpDir);
    await store.load();
    for (let id = 1; id <= 15; id += 1) store.remember(id);
    await store.flush();

    const stored = readFile().knownLocalUserIds;
    expect(stored).toHaveLength(MAX_KNOWN_LOCAL_USER_IDS);
    expect(stored[0]).toBe(15);
  });
});
