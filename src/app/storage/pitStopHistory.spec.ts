import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PitStopRecord } from '@irdashies/types';
import logger from '../logger';
import {
  MAX_PIT_STOP_HISTORY_SESSIONS,
  createPitStopHistoryStore,
} from './pitStopHistory';

let tmpDir: string;
let file: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-pit-stops-'));
  file = path.join(tmpDir, 'pit-stop-history.json');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true });
});

const stop = (overrides: Partial<PitStopRecord> = {}): PitStopRecord => ({
  id: 1,
  carIdx: 3,
  kind: 'pit',
  lap: 12,
  entryTime: 1000,
  exitTime: 1060,
  stallTime: 1010,
  stallSeconds: 40,
  stallEnteredAt: null,
  driverIdIn: 101,
  driverNameIn: 'Driver A',
  driverIdOut: 102,
  driverNameOut: 'Driver B',
  classPositionIn: 4,
  classPositionOut: 6,
  compoundIn: 0,
  compoundOut: 0,
  fastRepairs: 0,
  ...overrides,
});

const key = { subSessionId: 5001, sessionNum: 2 };

describe('pit stop history store', () => {
  it('saves finished stops and reads them back after a restart', async () => {
    const store = createPitStopHistoryStore(file);
    await store.load();
    store.save(key, [stop(), stop({ id: 2, exitTime: null })]);
    await store.flush();

    const reopened = createPitStopHistoryStore(file);
    await reopened.load();
    expect(reopened.get(key)).toEqual([stop()]);
    expect(reopened.get({ ...key, sessionNum: 1 })).toBeNull();
  });

  it('keeps only the most recent sessions', async () => {
    let clock = 0;
    const store = createPitStopHistoryStore(file, () => ++clock);
    await store.load();
    for (let i = 1; i <= MAX_PIT_STOP_HISTORY_SESSIONS + 2; i += 1) {
      store.save({ subSessionId: i, sessionNum: 0 }, [stop()]);
    }
    await store.flush();

    const reopened = createPitStopHistoryStore(file);
    await reopened.load();
    expect(reopened.get({ subSessionId: 1, sessionNum: 0 })).toBeNull();
    expect(
      reopened.get({
        subSessionId: MAX_PIT_STOP_HISTORY_SESSIONS + 2,
        sessionNum: 0,
      })
    ).toHaveLength(1);
  });

  it('ignores a damaged file', async () => {
    fs.writeFileSync(file, '{"version":1,"sessions":[{"bad":true}]}');
    const store = createPitStopHistoryStore(file);
    await store.load();
    expect(store.get(key)).toBeNull();
  });

  it('warns and starts empty when the file is not JSON', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    fs.writeFileSync(file, 'not json');
    const store = createPitStopHistoryStore(file);
    await store.load();
    expect(store.get(key)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('keeps a failed write pending, so the next flush saves it', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const blocked = path.join(tmpDir, 'blocked');
    fs.writeFileSync(blocked, '');
    const target = path.join(blocked, 'pit-stop-history.json');
    const store = createPitStopHistoryStore(target);
    store.save(key, [stop()]);
    await store.flush();
    fs.rmSync(blocked);
    await store.flush();

    const reopened = createPitStopHistoryStore(target);
    await reopened.load();
    expect(reopened.get(key)).toEqual([stop()]);
  });
});
