import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { LapHistorySnapshot } from '@irdashies/types';
import {
  LAP_CROSSING_IN_PIT,
  LAP_CROSSING_LAPPED,
  LAP_CROSSING_OFF_TRACK,
} from '@irdashies/types';
import logger from '../logger';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-lap-history-'));
  const { __resetForTests } = await import('./lapHistoryStorage');
  __resetForTests();
});

afterEach(async () => {
  const { __awaitPendingWrite } = await import('./lapHistoryStorage');
  await __awaitPendingWrite();
  fs.rmSync(tmpDir, { recursive: true });
});

const CAR_COUNT = 4;
const CAPACITY = 8;

function makeSnapshot(
  carCount = CAR_COUNT,
  capacity = CAPACITY
): LapHistorySnapshot {
  const slots = carCount * capacity;
  return {
    carCount,
    capacity,
    count: new Array<number>(carCount).fill(0),
    start: new Array<number>(carCount).fill(0),
    lap: new Array<number>(slots).fill(0),
    sessionTime: new Array<number>(slots).fill(0),
    classPosition: new Array<number>(slots).fill(0),
    flags: new Array<number>(slots).fill(0),
    sessionNum: 0,
    version: 0,
  };
}

interface Crossing {
  lap: number;
  sessionTime: number;
  classPosition: number;
  flags: number;
}

/** Appends through the same ring rule the processor uses. */
function append(
  snapshot: LapHistorySnapshot,
  carIdx: number,
  crossing: Crossing
): void {
  const count = snapshot.count as number[];
  const start = snapshot.start as number[];
  const used = count[carIdx];
  const offset =
    used < snapshot.capacity
      ? (start[carIdx] + used) % snapshot.capacity
      : start[carIdx];
  const slot = carIdx * snapshot.capacity + offset;
  (snapshot.lap as number[])[slot] = crossing.lap;
  (snapshot.sessionTime as number[])[slot] = crossing.sessionTime;
  (snapshot.classPosition as number[])[slot] = crossing.classPosition;
  (snapshot.flags as number[])[slot] = crossing.flags;
  if (used < snapshot.capacity) count[carIdx] = used + 1;
  else start[carIdx] = (start[carIdx] + 1) % snapshot.capacity;
}

function readBack(snapshot: LapHistorySnapshot, carIdx: number): Crossing[] {
  const out: Crossing[] = [];
  for (let i = 0; i < snapshot.count[carIdx]; i += 1) {
    const offset = (snapshot.start[carIdx] + i) % snapshot.capacity;
    const slot = carIdx * snapshot.capacity + offset;
    out.push({
      lap: snapshot.lap[slot],
      sessionTime: snapshot.sessionTime[slot],
      classPosition: snapshot.classPosition[slot],
      flags: snapshot.flags[slot],
    });
  }
  return out;
}

/** A schema 2 file body holding one session. */
function fileOf(snapshot: LapHistorySnapshot) {
  return {
    schema: 2 as const,
    sessions: { [String(snapshot.sessionNum)]: snapshot },
  };
}

function populated(): LapHistorySnapshot {
  const snapshot = makeSnapshot();
  append(snapshot, 0, {
    lap: 1,
    sessionTime: 91.25,
    classPosition: 3,
    flags: 0,
  });
  append(snapshot, 0, {
    lap: 2,
    sessionTime: 182.5,
    classPosition: 2,
    flags: LAP_CROSSING_IN_PIT,
  });
  append(snapshot, 2, {
    lap: 7,
    sessionTime: 640.125,
    classPosition: 255,
    flags: LAP_CROSSING_OFF_TRACK | LAP_CROSSING_LAPPED,
  });
  return snapshot;
}

describe('lapHistoryStorage', () => {
  it('loadLapHistory returns null when no file exists', async () => {
    const { loadLapHistory } = await import('./lapHistoryStorage');
    expect(await loadLapHistory('session123', tmpDir)).toBeNull();
  });

  it.each([
    '{}',
    'null',
    '[]',
    '{"schema":2,"history":{}}',
    '{"schema":2,"sessions":[]}',
    '{"schema":2,"sessions":{}}',
    '{"schema":3,"sessions":{}}',
    'not json',
  ])(
    'loadLapHistory returns null for invalid persisted shape %s',
    async (contents) => {
      const { loadLapHistory } = await import('./lapHistoryStorage');
      fs.writeFileSync(path.join(tmpDir, 'lap-history-invalid.json'), contents);

      expect(await loadLapHistory('invalid', tmpDir)).toBeNull();
    }
  );

  it('rejects a file whose buffers do not match its declared size', async () => {
    const { loadLapHistory } = await import('./lapHistoryStorage');
    const stored = fileOf(populated());
    (stored.sessions['0'] as unknown as { lap: number[] }).lap = [1, 2, 3];
    fs.writeFileSync(
      path.join(tmpDir, 'lap-history-short.json'),
      JSON.stringify(stored)
    );

    expect(await loadLapHistory('short', tmpDir)).toBeNull();
  });

  it.each([
    ['count above capacity', 'count', 9999],
    ['negative count', 'count', -1],
    ['fractional count', 'count', 1.5],
    ['start at capacity', 'start', 300],
    ['negative start', 'start', -1],
    ['fractional start', 'start', 0.5],
  ])('rejects a file with a bad ring index: %s', async (name, field, bad) => {
    // A bad pair repeats crossings or reads another car's slots once decoded.
    const { loadLapHistory } = await import('./lapHistoryStorage');
    const stored = fileOf(populated());
    (stored.sessions['0'] as unknown as Record<string, number[]>)[field][0] =
      bad;
    const id = `ring-${field}-${String(bad).replace(/[^a-z0-9]/gi, '')}`;
    fs.writeFileSync(
      path.join(tmpDir, `lap-history-${id}.json`),
      JSON.stringify(stored)
    );

    expect(await loadLapHistory(id, tmpDir)).toBeNull();
  });

  it('redacts the storage directory from invalid-file warnings', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { loadLapHistory } = await import('./lapHistoryStorage');
    fs.writeFileSync(path.join(tmpDir, 'lap-history-private.json'), '{}');

    expect(await loadLapHistory('private', tmpDir)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[LapHistoryStorage] Lap history file has an invalid shape:',
      'lap-history-private.json'
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(tmpDir);

    warn.mockRestore();
  });

  it('ignores empty session IDs without creating storage files', async () => {
    const { loadLapHistory, saveLapHistory, clearLapHistory } =
      await import('./lapHistoryStorage');

    expect(await loadLapHistory('', tmpDir)).toBeNull();
    await saveLapHistory('', populated(), tmpDir);
    await clearLapHistory('', tmpDir);

    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('round-trips the snapshot through disk without loss', async () => {
    const { saveLapHistory, loadLapHistory, __awaitPendingWrite } =
      await import('./lapHistoryStorage');
    const source = populated();

    await saveLapHistory('s1', source, tmpDir);
    await __awaitPendingWrite();
    const stored = await loadLapHistory('s1', tmpDir);

    expect(stored?.schema).toBe(2);
    expect(stored?.sessions['0']).toEqual(source);
  });

  it('rehydrates lap, sessionTime, classPosition and flags into a live snapshot', async () => {
    const {
      saveLapHistory,
      loadLapHistory,
      rehydrateLapHistory,
      __awaitPendingWrite,
    } = await import('./lapHistoryStorage');
    const source = populated();

    await saveLapHistory('s1', source, tmpDir);
    await __awaitPendingWrite();
    const stored = await loadLapHistory('s1', tmpDir);
    if (!stored) throw new Error('expected stored lap history');

    const target = makeSnapshot();
    expect(rehydrateLapHistory(stored, target)).toBe(true);

    expect(target.sessionNum).toBe(source.sessionNum);
    for (let carIdx = 0; carIdx < CAR_COUNT; carIdx += 1) {
      expect(target.count[carIdx]).toBe(source.count[carIdx]);
      expect(readBack(target, carIdx)).toEqual(readBack(source, carIdx));
    }
  });

  it('round-trips a wrapped ring buffer in oldest-to-newest order', async () => {
    const {
      saveLapHistory,
      loadLapHistory,
      rehydrateLapHistory,
      __awaitPendingWrite,
    } = await import('./lapHistoryStorage');
    const source = makeSnapshot();
    // Two more crossings than the ring holds, so the oldest two are gone.
    for (let lap = 1; lap <= CAPACITY + 2; lap += 1) {
      append(source, 1, {
        lap,
        sessionTime: lap * 90.5,
        classPosition: 1,
        flags: 0,
      });
    }
    expect(source.start[1]).toBe(2);

    await saveLapHistory('s1', source, tmpDir);
    await __awaitPendingWrite();
    const stored = await loadLapHistory('s1', tmpDir);
    if (!stored) throw new Error('expected stored lap history');
    const target = makeSnapshot();
    rehydrateLapHistory(stored, target);

    expect(target.start[1]).toBe(2);
    expect(readBack(target, 1).map((c) => c.lap)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(readBack(target, 1)).toEqual(readBack(source, 1));
  });

  it('writes plain JSON arrays, not indexed objects', async () => {
    const { saveLapHistory, __awaitPendingWrite } =
      await import('./lapHistoryStorage');
    await saveLapHistory('s1', populated(), tmpDir);
    await __awaitPendingWrite();

    const raw = fs.readFileSync(
      path.join(tmpDir, 'lap-history-s1.json'),
      'utf-8'
    );
    const parsed = JSON.parse(raw) as {
      schema: number;
      sessions: Record<string, { lap: unknown; count: unknown }>;
    };
    expect(parsed.schema).toBe(2);
    expect(Array.isArray(parsed.sessions['0'].lap)).toBe(true);
    expect(Array.isArray(parsed.sessions['0'].count)).toBe(true);
  });

  it('serialises the snapshot as it stands when the write fires', async () => {
    const { saveLapHistory, loadLapHistory, __awaitPendingWrite } =
      await import('./lapHistoryStorage');
    const source = makeSnapshot();
    append(source, 0, { lap: 1, sessionTime: 90, classPosition: 1, flags: 0 });

    await saveLapHistory('s1', source, tmpDir);
    // Later crossings land before the debounced write, so they must be included.
    append(source, 0, { lap: 2, sessionTime: 180, classPosition: 1, flags: 0 });
    await __awaitPendingWrite();

    const stored = await loadLapHistory('s1', tmpDir);
    if (!stored) throw new Error('expected stored lap history');
    expect(stored.sessions['0'].count[0]).toBe(2);
    expect(readBack(stored.sessions['0'], 0).map((c) => c.lap)).toEqual([1, 2]);
  });

  it('rejects rehydrating history recorded at a different capacity', async () => {
    const { rehydrateLapHistory } = await import('./lapHistoryStorage');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const stored = fileOf(makeSnapshot(CAR_COUNT, CAPACITY));
    const target = makeSnapshot(CAR_COUNT, CAPACITY * 2);

    expect(rehydrateLapHistory(stored, target)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clears any previous contents of the target before rehydrating', async () => {
    const { rehydrateLapHistory } = await import('./lapHistoryStorage');
    const target = populated();
    const stored = fileOf(makeSnapshot());

    rehydrateLapHistory(stored, target);

    expect([...target.count]).toEqual([0, 0, 0, 0]);
    expect([...target.start]).toEqual([0, 0, 0, 0]);
    expect([...target.lap]).toEqual(
      new Array<number>(CAR_COUNT * CAPACITY).fill(0)
    );
  });

  it('rehydrates in place so the live buffers keep their identity', async () => {
    const { rehydrateLapHistory } = await import('./lapHistoryStorage');
    const target = makeSnapshot();
    const buffers = { lap: target.lap, count: target.count };

    rehydrateLapHistory(fileOf(populated()), target);

    expect(target.lap).toBe(buffers.lap);
    expect(target.count).toBe(buffers.count);
    expect(target.count[0]).toBe(2);
  });

  it('clearLapHistory removes the session file', async () => {
    const { saveLapHistory, clearLapHistory, loadLapHistory } =
      await import('./lapHistoryStorage');
    await saveLapHistory('s1', populated(), tmpDir);
    await clearLapHistory('s1', tmpDir);

    expect(await loadLapHistory('s1', tmpDir)).toBeNull();
    expect(fs.existsSync(path.join(tmpDir, 'lap-history-s1.json'))).toBe(false);
  });

  it('keeps the current race plus one previous race and prunes the rest', async () => {
    const {
      saveLapHistory,
      pruneOldSessions,
      listSessionFiles,
      __awaitPendingWrite,
    } = await import('./lapHistoryStorage');
    for (const id of ['s1', 's2', 's3', 's4']) {
      await saveLapHistory(id, populated(), tmpDir);
    }
    await __awaitPendingWrite();
    ['s1', 's2', 's3', 's4'].forEach((id, index) => {
      const stamp = new Date(1_000 * (index + 1));
      fs.utimesSync(path.join(tmpDir, `lap-history-${id}.json`), stamp, stamp);
    });

    await pruneOldSessions('s4', tmpDir);

    const remaining = (await listSessionFiles(tmpDir)).map((f) =>
      path.basename(f)
    );
    expect(remaining).toEqual(['lap-history-s3.json', 'lap-history-s4.json']);
  });

  it('never prunes the current session even before its first write lands', async () => {
    const {
      saveLapHistory,
      pruneOldSessions,
      listSessionFiles,
      __awaitPendingWrite,
    } = await import('./lapHistoryStorage');
    for (const id of ['old1', 'old2']) {
      await saveLapHistory(id, populated(), tmpDir);
    }
    await __awaitPendingWrite();
    ['old1', 'old2'].forEach((id, index) => {
      const stamp = new Date(1_000 * (index + 1));
      fs.utimesSync(path.join(tmpDir, `lap-history-${id}.json`), stamp, stamp);
    });

    // The current session has recorded nothing yet, so it has no file.
    await pruneOldSessions('current', tmpDir);

    const remaining = (await listSessionFiles(tmpDir)).map((f) =>
      path.basename(f)
    );
    expect(remaining).toEqual(['lap-history-old2.json']);
  });

  it('does not recreate a pruned session from a pending write', async () => {
    const { saveLapHistory, pruneOldSessions, __awaitPendingWrite } =
      await import('./lapHistoryStorage');
    for (const id of ['s1', 's2', 's3']) {
      await saveLapHistory(id, populated(), tmpDir);
    }
    await __awaitPendingWrite();
    ['s1', 's2', 's3'].forEach((id, index) => {
      const stamp = new Date(1_000 * (index + 1));
      fs.utimesSync(path.join(tmpDir, `lap-history-${id}.json`), stamp, stamp);
    });

    await saveLapHistory('s1', populated(), tmpDir);
    await pruneOldSessions('s3', tmpDir);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fs.existsSync(path.join(tmpDir, 'lap-history-s1.json'))).toBe(false);
  });

  it('flushLapHistoryOnShutdown writes the pending session', async () => {
    const { saveLapHistory, flushLapHistoryOnShutdown } =
      await import('./lapHistoryStorage');
    await saveLapHistory('s1', populated(), tmpDir);

    // The debounce has not elapsed, so nothing is on disk yet.
    expect(fs.existsSync(path.join(tmpDir, 'lap-history-s1.json'))).toBe(false);

    await flushLapHistoryOnShutdown();

    expect(fs.existsSync(path.join(tmpDir, 'lap-history-s1.json'))).toBe(true);
  });
  describe('one file per event, one entry per session', () => {
    const writeRaw = (id: string, body: unknown) =>
      fs.writeFileSync(
        path.join(tmpDir, `lap-history-${id}.json`),
        JSON.stringify(body)
      );

    /** Moves the live buffers on to a new session, as the processor does. */
    const startSession = (snapshot: LapHistorySnapshot, sessionNum: number) => {
      (snapshot.count as number[]).fill(0);
      (snapshot.start as number[]).fill(0);
      snapshot.sessionNum = sessionNum;
    };

    it('migrates a schema 1 file to its session entry', async () => {
      const { loadLapHistory } = await import('./lapHistoryStorage');
      const legacy = { ...populated(), sessionNum: 2 };
      writeRaw('legacy', { schema: 1, history: legacy });

      const stored = await loadLapHistory('legacy', tmpDir);

      expect(stored?.schema).toBe(2);
      expect(Object.keys(stored?.sessions ?? {})).toEqual(['2']);
      expect(stored?.sessions['2']).toEqual(legacy);
    });

    it('drops a schema 1 file that cannot be keyed or is malformed', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const { loadLapHistory } = await import('./lapHistoryStorage');
      writeRaw('nonum', {
        schema: 1,
        history: { ...populated(), sessionNum: null },
      });
      writeRaw('bad', { schema: 1, history: { carCount: 'x' } });

      expect(await loadLapHistory('nonum', tmpDir)).toBeNull();
      expect(await loadLapHistory('bad', tmpDir)).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        '[LapHistoryStorage] Dropped a schema 1 file with an invalid shape:',
        'lap-history-nonum.json'
      );
      warn.mockRestore();
    });

    it('keeps the valid sessions of a file and drops the rest', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const { loadLapHistory } = await import('./lapHistoryStorage');
      writeRaw('mixed', {
        schema: 2,
        sessions: {
          '0': populated(),
          '1': { ...populated(), lap: [1] },
          // Key and sessionNum disagree.
          '2': { ...populated(), sessionNum: 5 },
          x: populated(),
        },
      });

      const stored = await loadLapHistory('mixed', tmpDir);

      expect(Object.keys(stored?.sessions ?? {})).toEqual(['0']);
      expect(warn).toHaveBeenCalledTimes(3);
      warn.mockRestore();
    });

    it('keeps qualifying when the race starts', async () => {
      const {
        saveLapHistory,
        sealLapHistorySession,
        loadLapHistory,
        __awaitPendingWrite,
      } = await import('./lapHistoryStorage');
      const live = { ...populated(), sessionNum: 1 };
      await saveLapHistory('event', live, tmpDir);

      await sealLapHistorySession('event', live, tmpDir);
      startSession(live, 2);
      append(live, 3, { lap: 1, sessionTime: 50, classPosition: 1, flags: 0 });
      await saveLapHistory('event', live, tmpDir);
      await __awaitPendingWrite();

      const stored = await loadLapHistory('event', tmpDir);
      expect(Object.keys(stored?.sessions ?? {})).toEqual(['1', '2']);
      expect(stored?.sessions['1'].count[0]).toBe(2);
      expect(stored?.sessions['2'].count[0]).toBe(0);
      expect(stored?.sessions['2'].count[3]).toBe(1);
    });

    it('keeps a sealed session when the buffers reset straight after the seal', async () => {
      const {
        sealLapHistorySession,
        loadLapHistory,
        __awaitPendingWrite,
        __resetForTests,
      } = await import('./lapHistoryStorage');
      const live: LapHistorySnapshot = { ...populated(), sessionNum: 1 };

      // The runtime seals, then resets the processor without waiting.
      const sealing = sealLapHistorySession('reset', live, tmpDir);
      (live.count as number[]).fill(0);
      (live.start as number[]).fill(0);
      live.sessionNum = null;
      await sealing;
      await __awaitPendingWrite();
      __resetForTests();

      const stored = await loadLapHistory('reset', tmpDir);
      expect(Object.keys(stored?.sessions ?? {})).toEqual(['1']);
      const qualifying = stored?.sessions['1'];
      expect(qualifying?.sessionNum).toBe(1);
      expect(qualifying && readBack(qualifying, 0)).toHaveLength(2);
    });

    it('does not write a live snapshot whose buffers moved to another session', async () => {
      const { saveLapHistory, loadLapHistory, __awaitPendingWrite } =
        await import('./lapHistoryStorage');
      const live = { ...populated(), sessionNum: 1 };
      await saveLapHistory('moved', live, tmpDir);

      startSession(live, 2);
      await __awaitPendingWrite();

      expect(await loadLapHistory('moved', tmpDir)).toBeNull();
    });

    it('merges sessions already on disk after a restart', async () => {
      const {
        saveLapHistory,
        loadLapHistory,
        __awaitPendingWrite,
        __resetForTests,
      } = await import('./lapHistoryStorage');
      await saveLapHistory(
        'restart',
        { ...populated(), sessionNum: 0 },
        tmpDir
      );
      await __awaitPendingWrite();
      __resetForTests();

      await saveLapHistory(
        'restart',
        { ...populated(), sessionNum: 1 },
        tmpDir
      );
      await __awaitPendingWrite();

      const stored = await loadLapHistory('restart', tmpDir);
      expect(Object.keys(stored?.sessions ?? {})).toEqual(['0', '1']);
    });

    it('keeps the newest sessions when over the cap', async () => {
      const {
        sealLapHistorySession,
        loadLapHistory,
        __awaitPendingWrite,
        MAX_SESSIONS_PER_FILE,
      } = await import('./lapHistoryStorage');
      const total = MAX_SESSIONS_PER_FILE + 4;
      for (let sessionNum = 0; sessionNum < total; sessionNum += 1) {
        await sealLapHistorySession(
          'capped',
          { ...populated(), sessionNum },
          tmpDir
        );
      }
      await __awaitPendingWrite();

      const kept = Object.keys(
        (await loadLapHistory('capped', tmpDir))?.sessions ?? {}
      ).map(Number);
      expect(kept).toHaveLength(MAX_SESSIONS_PER_FILE);
      expect(Math.min(...kept)).toBe(4);
      expect(Math.max(...kept)).toBe(total - 1);
    });

    it('reads one archived session and lists the stored ones', async () => {
      const {
        sealLapHistorySession,
        loadArchivedLapHistory,
        listArchivedLapHistorySessions,
      } = await import('./lapHistoryStorage');
      await sealLapHistorySession(
        'arch',
        { ...populated(), sessionNum: 3 },
        tmpDir
      );
      await sealLapHistorySession(
        'arch',
        { ...populated(), sessionNum: 1 },
        tmpDir
      );

      // A pending write is flushed before the read.
      expect(await listArchivedLapHistorySessions('arch', tmpDir)).toEqual([
        1, 3,
      ]);
      expect(
        (await loadArchivedLapHistory('arch', 3, tmpDir))?.sessionNum
      ).toBe(3);
      expect(await loadArchivedLapHistory('arch', 2, tmpDir)).toBeNull();
      expect(await loadArchivedLapHistory('missing', 0, tmpDir)).toBeNull();
    });

    it('rehydrates only the session the target is on', async () => {
      const { rehydrateLapHistory } = await import('./lapHistoryStorage');
      const stored = fileOf({ ...populated(), sessionNum: 1 });

      const onRace = { ...makeSnapshot(), sessionNum: 2 };
      expect(rehydrateLapHistory(stored, onRace)).toBe(false);
      expect(onRace.count[0]).toBe(0);

      const onQualifying = { ...makeSnapshot(), sessionNum: 1 };
      expect(rehydrateLapHistory(stored, onQualifying)).toBe(true);
      expect(onQualifying.count[0]).toBe(2);
    });
  });
});
