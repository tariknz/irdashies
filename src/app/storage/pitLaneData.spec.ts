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

describe('pit lane calibration file editing', () => {
  it('creates an empty file only when missing, without requiring a session', async () => {
    expect(await store.prepareFile()).toBe(file);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({});
  });

  it('opens existing malformed JSON as-is, without loading or overwriting it', async () => {
    const invalid = '{unfinished edit';
    await writeFile(file, invalid);
    expect(await store.prepareFile()).toBe(file);
    await store.flush();
    expect(await readFile(file, 'utf8')).toBe(invalid);
  });

  it('flushes pending learned values before opening the file', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.update('47', { pitEntryPct: 0.91 });
    await store.prepareFile();
    expect(JSON.parse(await readFile(file, 'utf8'))['47'].pitEntryPct).toBe(
      0.91
    );
  });

  it('applies saved edits and deletions while preserving other tracks', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.get('47');
    const edited = {
      '47': { pitEntryPct: 0.9, pitExitPct: null },
      '321': { pitEntryPct: null, pitExitPct: 0.1 },
    };
    const bytes = JSON.stringify(edited);
    await writeFile(file, bytes);
    expect(await store.reload()).toEqual([
      { trackId: '47', data: edited['47'] },
      { trackId: '181', data: null },
      { trackId: '321', data: edited['321'] },
    ]);
    expect(await store.get('47')).toEqual(edited['47']);
    expect(await store.get('181')).toBeNull();
    await store.flush();
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it('cancels an unflushed learned value before reading external edits', async () => {
    vi.useFakeTimers();
    try {
      await writeFile(file, JSON.stringify(original));
      await store.update('47', { pitEntryPct: 0.91 });
      const edited = {
        ...original,
        '47': { pitEntryPct: 0.8, pitExitPct: 0.04 },
      };
      const bytes = JSON.stringify(edited);
      await writeFile(file, bytes);
      await store.reload();
      await vi.advanceTimersByTimeAsync(500);
      expect(await store.get('47')).toEqual(edited['47']);
      expect(await store.get('181')).toEqual(original['181']);
      expect(await readFile(file, 'utf8')).toBe(bytes);
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for an in-flight atomic write before reading saved external edits', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.update('47', { pitEntryPct: 0.91 });
    const edited = {
      ...original,
      '47': { pitEntryPct: 0.8, pitExitPct: 0.04 },
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realRename = fsp.rename.bind(fsp);
    const rename = vi
      .spyOn(fsp, 'rename')
      .mockImplementationOnce(async (...args) => {
        await gate;
        await realRename(...args);
        // The editor saves once the already-started app write has completed.
        await writeFile(file, JSON.stringify(edited));
      });
    const writing = store.flush();
    await vi.waitFor(() => expect(rename).toHaveBeenCalled());
    const reading = vi.spyOn(fsp, 'readFile');
    const reloading = store.reload();
    await Promise.resolve();
    expect(reading).not.toHaveBeenCalled();
    release();
    await Promise.all([writing, reloading]);
    expect(await store.get('47')).toEqual(edited['47']);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(edited);
  });

  it.each([
    '{bad json',
    'null',
    '[]',
    '{"bad-track":{"pitEntryPct":0.9,"pitExitPct":0.05}}',
    '{"47":{"pitEntryPct":2,"pitExitPct":0.05}}',
    '{"47":{"pitEntryPct":"0.9","pitExitPct":0.05}}',
    '{"47":{"pitEntryPct":0.9}}',
    '{"47":{"pitEntryPct":0.9,"pitExitPct":0.05,"unexpected":true}}',
  ])(
    'rejects invalid edits %s and preserves good cache plus original edited bytes',
    async (invalid) => {
      await writeFile(file, JSON.stringify(original));
      await store.get('47');
      await writeFile(file, invalid);
      await expect(store.reload()).rejects.toThrow();
      expect(await store.get('47')).toEqual(original['47']);
      expect(await store.get('181')).toEqual(original['181']);
      // Neither Open file nor shutdown may overwrite the invalid file the user
      // still needs to repair from an unchanged cached copy.
      await store.prepareFile();
      await store.flush();
      expect(await readFile(file, 'utf8')).toBe(invalid);
    }
  );
});

describe('pit lane initial-read write protection', () => {
  it.each(['EBUSY', 'EPERM', 'EACCES'])(
    'retries a transient %s read instead of caching an empty writable map',
    async (code) => {
      const bytes = JSON.stringify(original);
      await writeFile(file, bytes);
      const reading = vi
        .spyOn(fsp, 'readFile')
        .mockRejectedValueOnce(
          Object.assign(new Error('temporary read failure'), { code })
        );
      const writing = vi.spyOn(fsp, 'writeFile');
      expect(await store.get('47')).toBeNull();
      await store.flush();
      expect(writing).not.toHaveBeenCalled();
      expect(await store.get('181')).toEqual(original['181']);
      expect(reading).toHaveBeenCalledTimes(2);
      expect(await readFile(file, 'utf8')).toBe(bytes);
    }
  );

  it.each(['update', 'clear'] as const)(
    'rejects %s after a failed read and safely retries the complete file later',
    async (operation) => {
      const bytes = JSON.stringify(original);
      await writeFile(file, bytes);
      vi.spyOn(fsp, 'readFile').mockRejectedValueOnce(
        Object.assign(new Error('temporary access failure'), { code: 'EACCES' })
      );
      const writing = vi.spyOn(fsp, 'writeFile');
      const mutation =
        operation === 'update'
          ? store.update('47', { pitEntryPct: 0.8 })
          : store.clear('47');
      await expect(mutation).rejects.toThrow('could not be read safely');
      await store.flush();
      expect(writing).not.toHaveBeenCalled();
      expect(await readFile(file, 'utf8')).toBe(bytes);
      await store.update('47', { pitEntryPct: 0.8 });
      await store.flush();
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
        ...original,
        '47': { pitEntryPct: 0.8, pitExitPct: 0.05 },
      });
    }
  );

  it.each([
    '{unfinished JSON',
    JSON.stringify({ ...original, '5': { pitEntryPct: 3, pitExitPct: 0.1 } }),
  ])(
    'keeps malformed or partially invalid initial data read-only until repaired',
    async (bytes) => {
      await writeFile(file, bytes);
      const writing = vi.spyOn(fsp, 'writeFile');
      await store.get('47');
      await expect(store.update('47', { pitEntryPct: 0.8 })).rejects.toThrow(
        'could not be read safely'
      );
      await expect(store.clear('47')).rejects.toThrow(
        'could not be read safely'
      );
      await store.flush();
      expect(writing).not.toHaveBeenCalled();
      expect(await readFile(file, 'utf8')).toBe(bytes);
      await writeFile(file, JSON.stringify(original));
      await store.update('47', { pitEntryPct: 0.8 });
      await store.flush();
      expect(await store.get('181')).toEqual(original['181']);
    }
  );

  it('does not rewrite a read-only session at shutdown', async () => {
    const bytes = JSON.stringify(original);
    await writeFile(file, bytes);
    const writing = vi.spyOn(fsp, 'writeFile');
    expect(await store.get('47')).toEqual(original['47']);
    await store.flush();
    expect(writing).not.toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it('allows a missing ENOENT file to initialize with newly learned values', async () => {
    await store.update('47', { pitEntryPct: 0.8 });
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      '47': { pitEntryPct: 0.8, pitExitPct: null },
    });
  });
});

describe('reloading a repaired initial calibration file', () => {
  it.each(['edit', 'delete'] as const)(
    'invalidates a record displayed from incomplete data after a repair that %ss it',
    async (change) => {
      await writeFile(
        file,
        JSON.stringify({
          ...original,
          '5': { pitEntryPct: 3, pitExitPct: 0.1 },
        })
      );
      expect(await store.get('47')).toEqual(original['47']);
      const edited = { pitEntryPct: 0.8, pitExitPct: null };
      await writeFile(
        file,
        JSON.stringify(change === 'edit' ? { '47': edited } : {})
      );
      expect(await store.reload()).toEqual(
        expect.arrayContaining([
          { trackId: '47', data: change === 'edit' ? edited : null },
        ])
      );
    }
  );
});

describe('protecting external calibration edits from automatic learning', () => {
  it('drains old atomic writes before opening and pauses every later learning write until reload', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.update('47', { pitEntryPct: 0.91 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realRename = fsp.rename.bind(fsp);
    const rename = vi
      .spyOn(fsp, 'rename')
      .mockImplementationOnce(async (...args) => {
        await gate;
        await realRename(...args);
      });
    const opening = store.prepareFile();
    const opened = vi.fn();
    void opening.then(opened);
    await vi.waitFor(() => expect(rename).toHaveBeenCalled());
    expect(opened).not.toHaveBeenCalled();
    const draining = store.flush();
    const drained = vi.fn();
    void draining.then(drained);
    await Promise.resolve();
    expect(drained).not.toHaveBeenCalled();
    expect(await store.update('47', { pitEntryPct: 0.8 })).toBe(false);
    release();
    await Promise.all([opening, draining]);
    const edited = {
      ...original,
      '47': { pitEntryPct: 0.7, pitExitPct: 0.03 },
    };
    const bytes = JSON.stringify(edited);
    await writeFile(file, bytes);
    expect(await store.update('47', { pitEntryPct: 0.6 })).toBe(false);
    await expect(store.clear('47')).rejects.toThrow(
      'before resetting while editing'
    );
    await store.flush();
    expect(await readFile(file, 'utf8')).toBe(bytes);
    await store.reload();
    expect(store.isEditing()).toBe(false);
    expect(await store.update('47', { pitExitPct: 0.04 })).toBe(true);
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      ...edited,
      '47': { pitEntryPct: 0.7, pitExitPct: 0.04 },
    });
  });

  it('keeps invalid external edits protected until a valid reload succeeds', async () => {
    await writeFile(file, JSON.stringify(original));
    await store.get('47');
    await store.prepareFile();
    await writeFile(file, '{unfinished edit');
    await expect(store.reload()).rejects.toThrow();
    expect(store.isEditing()).toBe(true);
    expect(await store.update('47', { pitEntryPct: 0.8 })).toBe(false);
    await expect(store.clear('47')).rejects.toThrow();
    await store.prepareFile();
    await store.flush();
    expect(await readFile(file, 'utf8')).toBe('{unfinished edit');
    await writeFile(file, JSON.stringify(original));
    await store.reload();
    expect(store.isEditing()).toBe(false);
  });

  it('restores learning when preparing the editor fails', async () => {
    await writeFile(file, JSON.stringify(original));
    vi.spyOn(fsp, 'access').mockRejectedValueOnce(
      Object.assign(new Error('locked'), { code: 'EACCES' })
    );
    await expect(store.prepareFile()).rejects.toThrow('locked');
    expect(store.isEditing()).toBe(false);
    expect(await store.update('47', { pitEntryPct: 0.8 })).toBe(true);
  });
});
