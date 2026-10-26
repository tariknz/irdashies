import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import logger from '../logger';
import {
  MAX_RACE_PLAN_HISTORY_ENTRIES,
  MAX_RACE_PLAN_HISTORY_SESSIONS,
  createRacePlanHistoryStore,
  type RacePlanHistoryRecord,
} from './racePlanHistory';

let tmpDir: string;
let file: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-race-plan-'));
  file = path.join(tmpDir, 'race-plan-history.json');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  fs.rmSync(tmpDir, { recursive: true });
});

const record = (
  subSessionId: number,
  overrides: Partial<RacePlanHistoryRecord> = {}
): RacePlanHistoryRecord => ({
  subSessionId,
  sessionNum: 2,
  greenSessionTime: 120.5,
  raceStartMs: 1_900_000_000_000,
  finished: false,
  stints: [
    {
      driverId: 101,
      startLap: 0,
      startSec: 0,
      endLap: 30,
      endSec: 3300,
      planIndex: 0,
      fueled: true,
    },
    {
      driverId: 102,
      startLap: 30,
      startSec: 3350,
      endLap: null,
      endSec: null,
      planIndex: 1,
      fueled: false,
    },
  ],
  stops: [
    {
      lap: 30,
      elapsedSec: 3300,
      durationSec: 50,
      fuelAdded: 34.5,
      fuelAssumed: false,
      driverChanged: true,
      compoundChanged: false,
      unplanned: false,
    },
  ],
  ...overrides,
});

const readFile = () =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as {
    version: number;
    sessions: (RacePlanHistoryRecord & { savedAt: number })[];
  };

describe('race plan history store', () => {
  it('has no history when no file exists', async () => {
    const store = createRacePlanHistoryStore(file);
    await store.load();
    expect(store.get(1)).toBeNull();
  });

  it('saves after the debounce and reads it back in a new store', async () => {
    vi.useFakeTimers();
    const store = createRacePlanHistoryStore(file, () => 10);
    await store.load();
    store.save(record(77));
    expect(fs.existsSync(file)).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    await store.flush();
    expect(readFile().sessions[0]).toMatchObject({ subSessionId: 77 });
    expect(fs.readdirSync(tmpDir)).toEqual(['race-plan-history.json']);

    const reloaded = createRacePlanHistoryStore(file);
    await reloaded.load();
    expect(reloaded.get(77)).toEqual(record(77));
  });

  it('returns copies, so callers cannot change what is stored', async () => {
    const store = createRacePlanHistoryStore(file);
    await store.load();
    const saved = record(5);
    store.save(saved);
    saved.stints[0].driverId = 999;
    const got = store.get(5);
    expect(got?.stints[0].driverId).toBe(101);
    if (got) got.stops.length = 0;
    expect(store.get(5)?.stops).toHaveLength(1);
  });

  it(`keeps the ${MAX_RACE_PLAN_HISTORY_SESSIONS} most recently saved sessions`, async () => {
    let clock = 0;
    const store = createRacePlanHistoryStore(file, () => (clock += 1));
    await store.load();
    for (let id = 1; id <= MAX_RACE_PLAN_HISTORY_SESSIONS + 2; id += 1) {
      store.save(record(id));
    }
    store.save(record(1));
    await store.flush();
    const ids = readFile().sessions.map((session) => session.subSessionId);
    expect(ids).toEqual([1, 7, 6, 5, 4]);
    expect(store.get(2)).toBeNull();
  });

  it(`caps stints and stops at ${MAX_RACE_PLAN_HISTORY_ENTRIES}`, async () => {
    const store = createRacePlanHistoryStore(file);
    await store.load();
    const many = record(9);
    many.stops = Array.from({ length: 70 }, (_, lap) => ({
      ...many.stops[0],
      lap,
    }));
    store.save(many);
    expect(store.get(9)?.stops).toHaveLength(MAX_RACE_PLAN_HISTORY_ENTRIES);
    expect(store.get(9)?.stops.at(-1)?.lap).toBe(69);
  });

  it.each(['not json', '{}', '{"version":1,"sessions":"x"}', 'null'])(
    'starts empty and warns for %s',
    async (contents) => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      fs.writeFileSync(file, contents);
      const store = createRacePlanHistoryStore(file);
      await store.load();
      expect(store.get(77)).toBeNull();
      expect(warn).toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(tmpDir);
    }
  );

  it('drops invalid sessions and keeps the valid ones', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        sessions: [
          { ...record(1), savedAt: 5 },
          { ...record(2), stints: [{ startLap: 'x' }], savedAt: 4 },
          { ...record(3), subSessionId: -3, savedAt: 3 },
          { ...record(4), savedAt: 'later' },
          {
            ...record(5),
            stints: [{ ...record(5).stints[0], planIndex: -1 }],
            savedAt: 2,
          },
          {
            ...record(6),
            stints: [{ ...record(6).stints[0], fueled: 'yes' }],
            savedAt: 1,
          },
        ],
      })
    );
    const store = createRacePlanHistoryStore(file);
    await store.load();
    expect(store.get(1)).toEqual(record(1));
    expect(store.get(2)).toBeNull();
    expect(store.get(4)).toBeNull();
    expect(store.get(5)).toBeNull();
    expect(store.get(6)).toBeNull();
  });

  it('keeps a session saved while the file was being read', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, sessions: [{ ...record(1), savedAt: 1 }] })
    );
    const store = createRacePlanHistoryStore(file, () => 100);
    const loading = store.load();
    store.save(record(2, { finished: true }));
    await loading;
    await store.flush();
    expect(store.get(1)).not.toBeNull();
    expect(readFile().sessions.map((s) => s.subSessionId)).toEqual([2, 1]);
  });

  it('warns and removes the temp file when a write fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const blocked = path.join(tmpDir, 'blocked');
    fs.writeFileSync(blocked, '');
    const store = createRacePlanHistoryStore(
      path.join(blocked, 'race-plan-history.json')
    );
    store.save(record(1));
    await store.flush();
    expect(warn).toHaveBeenCalled();
    expect(fs.readdirSync(tmpDir)).toEqual(['blocked']);
  });
});
