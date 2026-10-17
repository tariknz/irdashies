import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PitLaneDataStore } from './pitLaneData';

vi.mock('electron', () => ({ app: { getPath: () => '/mock/userData' } }));
vi.mock('../logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

let directory: string;
let file: string;
let store: PitLaneDataStore;
const original = {
  '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
  '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
};

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'irdashies-pit-lane-'));
  file = path.join(directory, 'pitLaneData.json');
  store = new PitLaneDataStore(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await store.flush();
  await rm(directory, { recursive: true, force: true });
});

describe('PitLaneDataStore', () => {
  it('loads existing legacy calibration and partial null values', async () => {
    await writeFile(
      file,
      JSON.stringify({
        ...original,
        '321': { pitEntryPct: null, pitExitPct: 0.06 },
      })
    );
    expect(await store.get('47')).toEqual(original['47']);
    expect(await store.get('321')).toEqual({
      pitEntryPct: null,
      pitExitPct: 0.06,
    });
    expect(await store.get('999')).toBeNull();
  });

  it.each(['null', '[]', '{broken'])(
    'uses a safe default for invalid storage %s',
    async (contents) => {
      await writeFile(file, contents);
      expect(await store.get('47')).toBeNull();
    }
  );

  it('drops malformed records without dropping other tracks', async () => {
    await writeFile(
      file,
      JSON.stringify({ ...original, '5': { pitEntryPct: 3, pitExitPct: 0.1 } })
    );
    expect(await store.get('5')).toBeNull();
    expect(await store.get('181')).toEqual(original['181']);
  });

  it('preserves other tracks while concurrent updates share the initial read', async () => {
    await writeFile(file, JSON.stringify(original));
    await Promise.all([
      store.update('47', { pitEntryPct: 0.93 }),
      store.update('321', { pitExitPct: 0.06 }),
      store.update('321', { pitEntryPct: 0.91 }),
    ]);
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      ...original,
      '47': { pitEntryPct: 0.93, pitExitPct: 0.05 },
      '321': { pitEntryPct: 0.91, pitExitPct: 0.06 },
    });
  });

  it('removes only the selected track and survives a fresh load', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.clear('47');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      '181': original['181'],
    });
    expect(await new PitLaneDataStore(file).get('47')).toBeNull();
  });

  it('queues reset behind an old in-flight disk write', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.update('47', { pitEntryPct: 0.91 });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realWrite = fsp.writeFile.bind(fsp);
    const spy = vi
      .spyOn(fsp, 'writeFile')
      .mockImplementationOnce(async (...args) => {
        await blocked;
        await realWrite(...args);
      });
    const oldWrite = store.flush();
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    const reset = store.clear('47');
    release();
    await Promise.all([oldWrite, reset]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      '181': original['181'],
    });
  });

  it('reports a failed reset and retains the previous cached calibration', async () => {
    await writeFile(file, JSON.stringify(original));
    vi.spyOn(fsp, 'writeFile').mockRejectedValueOnce(new Error('disk full'));
    await expect(store.clear('47')).rejects.toThrow('disk full');
    expect(await store.get('47')).toEqual(original['47']);
  });

  it('coalesces learned values until an explicit shutdown flush', async () => {
    await writeFile(file, JSON.stringify({}));
    const spy = vi.spyOn(fsp, 'writeFile');
    await store.update('47', { pitEntryPct: 0.92 });
    await store.update('47', { pitExitPct: 0.05 });
    expect(spy).not.toHaveBeenCalled();
    await store.flush();
    expect(spy).toHaveBeenCalledOnce();
  });
});
