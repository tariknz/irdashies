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

  it.each(['{}', 'null', '[]', '{"schema":2,"history":{}}', 'not json'])(
    'loadLapHistory returns null for invalid persisted shape %s',
    async (contents) => {
      const { loadLapHistory } = await import('./lapHistoryStorage');
      fs.writeFileSync(path.join(tmpDir, 'lap-history-invalid.json'), contents);

      expect(await loadLapHistory('invalid', tmpDir)).toBeNull();
    }
  );

  it('rejects a file whose buffers do not match its declared size', async () => {
    const { loadLapHistory, serializeLapHistory } =
      await import('./lapHistoryStorage');
    const stored = serializeLapHistory(populated());
    (stored.history as unknown as { lap: number[] }).lap = [1, 2, 3];
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
    const { loadLapHistory, serializeLapHistory } =
      await import('./lapHistoryStorage');
    const stored = serializeLapHistory(populated());
    (stored.history as unknown as Record<string, number[]>)[field][0] = bad;
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

    expect(stored?.schema).toBe(1);
    expect(stored?.history).toEqual(source);
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
      history: { lap: unknown; count: unknown };
    };
    expect(parsed.schema).toBe(1);
    expect(Array.isArray(parsed.history.lap)).toBe(true);
    expect(Array.isArray(parsed.history.count)).toBe(true);
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
    expect(stored.history.count[0]).toBe(2);
    expect(readBack(stored.history, 0).map((c) => c.lap)).toEqual([1, 2]);
  });

  it('rejects rehydrating history recorded at a different capacity', async () => {
    const { serializeLapHistory, rehydrateLapHistory } =
      await import('./lapHistoryStorage');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const stored = serializeLapHistory(makeSnapshot(CAR_COUNT, CAPACITY));
    const target = makeSnapshot(CAR_COUNT, CAPACITY * 2);

    expect(rehydrateLapHistory(stored, target)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clears any previous contents of the target before rehydrating', async () => {
    const { serializeLapHistory, rehydrateLapHistory } =
      await import('./lapHistoryStorage');
    const target = populated();
    const stored = serializeLapHistory(makeSnapshot());

    rehydrateLapHistory(stored, target);

    expect([...target.count]).toEqual([0, 0, 0, 0]);
    expect([...target.start]).toEqual([0, 0, 0, 0]);
    expect([...target.lap]).toEqual(
      new Array<number>(CAR_COUNT * CAPACITY).fill(0)
    );
  });

  it('rehydrates in place so the live buffers keep their identity', async () => {
    const { serializeLapHistory, rehydrateLapHistory } =
      await import('./lapHistoryStorage');
    const target = makeSnapshot();
    const buffers = { lap: target.lap, count: target.count };

    rehydrateLapHistory(serializeLapHistory(populated()), target);

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
});
