import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushJsonFileStoresOnShutdown, JsonFileStore } from './jsonFileStore';

describe('JsonFileStore', () => {
  let directory: string;
  let file: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'json-file-store-'));
    file = path.join(directory, 'store.json');
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('keeps changes in memory and writes them together after the debounce', async () => {
    const store = new JsonFileStore(file);
    store.set('a', 1);
    store.set('b', 2);
    expect(store.get('a')).toBe(1);
    expect(fs.existsSync(file)).toBe(false);

    await vi.waitFor(() => expect(fs.existsSync(file)).toBe(true));
    await store.close();
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ a: 1, b: 2 });
  });

  it('writes at once when flushed, and a new store reads it back', async () => {
    const store = new JsonFileStore(file);
    store.set('track', { lap: 1000 });
    await store.close();

    const next = new JsonFileStore(file);
    await next.restore();
    expect(next.get('track')).toEqual({ lap: 1000 });
    expect(next.entries()).toEqual([['track', { lap: 1000 }]]);
    await next.close();
  });

  it('writes what every open store holds when the app quits', async () => {
    const store = new JsonFileStore(file);
    store.set('a', 1);
    await flushJsonFileStoresOnShutdown();

    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ a: 1 });
    await store.close();
  });

  it('starts empty from a missing or broken file', async () => {
    const store = new JsonFileStore(file);
    await store.restore();
    expect(store.entries()).toEqual([]);

    fs.writeFileSync(file, '[1, 2]');
    await store.restore();
    expect(store.entries()).toEqual([]);
    await store.close();
  });

  it('warns about a file it cannot parse, but not about a missing one', async () => {
    const log = { warn: vi.fn() };
    const store = new JsonFileStore(file, log);
    await store.restore();
    expect(log.warn).not.toHaveBeenCalled();

    fs.writeFileSync(file, '{not json');
    await store.restore();
    expect(store.entries()).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to read ${file}`)
    );
    await store.close();
  });

  it('reports a write that fails instead of throwing', async () => {
    const log = { warn: vi.fn() };
    const store = new JsonFileStore(
      path.join(directory, 'missing', 'x.json'),
      log
    );
    store.set('a', 1);

    await expect(store.flush()).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write')
    );
  });
});
