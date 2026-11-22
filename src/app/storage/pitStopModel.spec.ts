import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitServiceSample, PitTransitSample } from '@irdashies/types';
import {
  MAX_KEYS,
  MAX_SAMPLES_PER_KEY,
  parsePitStopModel,
  PitStopModelStore,
} from './pitStopModel';

vi.mock('electron', () => ({ app: { getPath: () => '/mock/userData' } }));
vi.mock('../logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

const transit = (at = 1): PitTransitSample => ({
  at,
  build: 'b',
  seriesId: 1,
  trackId: 10,
  carId: 20,
  carClassId: 30,
  ruleSet: 'default',
  source: 'opponent',
  pitSpeedLimitKph: 60,
  entryPct: 0.9,
  exitPct: 0.05,
  windowSeconds: 60,
  stationarySeconds: 25,
  referenceSeconds: 15,
  windowStartPct: 0.88,
  windowEndPct: 0.08,
});

const service = (): PitServiceSample => ({
  ...transit(),
  serviceSeconds: 44,
  fuelAddedLitres: 60,
  fuelSeconds: 24,
  tankLitres: 100,
  tankPct: 1,
  tyresChanged: 15,
  repairSeconds: 0,
  fastRepair: false,
  tearOff: false,
});

let directory: string;
let file: string;
let store: PitStopModelStore;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'irdashies-pit-model-'));
  file = path.join(directory, 'pitStopModel.json');
  store = new PitStopModelStore(file);
});

afterEach(async () => {
  await store.flush();
  await rm(directory, { recursive: true, force: true });
});

const readBack = async () => JSON.parse(await readFile(file, 'utf8'));

describe('PitStopModelStore', () => {
  it('starts empty and writes samples when no file exists', async () => {
    await store.load();
    store.addTransit('10:20', transit());
    store.addService('default:20', service());
    await store.flush();
    const saved = await readBack();
    expect(saved.transit['10:20']).toHaveLength(1);
    expect(saved.service['default:20']).toHaveLength(1);
    expect(saved.order).toEqual(['transit|10:20', 'service|default:20']);
  });

  it('keeps the newest samples per key', async () => {
    await store.load();
    for (let i = 0; i < MAX_SAMPLES_PER_KEY + 3; i++) {
      store.addTransit('10:20', transit(i));
    }
    const samples = store.read().transit['10:20'];
    expect(samples).toHaveLength(MAX_SAMPLES_PER_KEY);
    expect(samples[0].at).toBe(3);
  });

  it("keeps the player's samples when opponents' stops fill the key", async () => {
    await store.load();
    store.addTransit('10:20', { ...transit(0), source: 'player' });
    for (let i = 1; i <= MAX_SAMPLES_PER_KEY + 3; i++) {
      store.addTransit('10:20', transit(i));
    }
    const samples = store.read().transit['10:20'];
    const player = samples.filter((sample) => sample.source === 'player');
    const opponents = samples.filter((sample) => sample.source === 'opponent');
    expect(player.map((sample) => sample.at)).toEqual([0]);
    expect(opponents).toHaveLength(MAX_SAMPLES_PER_KEY);
    expect(opponents[0].at).toBe(4);
  });

  it("keeps the player's samples when loading a file full of opponents' stops", () => {
    const opponents = Array.from({ length: MAX_SAMPLES_PER_KEY + 3 }, (_, i) =>
      transit(i + 1)
    );
    const { data } = parsePitStopModel({
      version: 1,
      transit: { '10:20': [{ ...transit(0), source: 'player' }, ...opponents] },
      service: {},
    });
    const samples = data.transit['10:20'];
    expect(samples.filter((s) => s.source === 'player')).toHaveLength(1);
    expect(samples.filter((s) => s.source === 'opponent')).toHaveLength(
      MAX_SAMPLES_PER_KEY
    );
  });

  it('drops the least recently used key past the cap', async () => {
    await store.load();
    for (let i = 0; i <= MAX_KEYS; i++) store.addTransit(`${i}:1`, transit());
    expect(store.read().transit['0:1']).toBeUndefined();
    expect(Object.keys(store.read().transit)).toHaveLength(MAX_KEYS);
  });

  it('keeps hand-edited overrides across a save', async () => {
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        transit: {},
        service: {},
        overrides: { 'imsa:20': { fourTyreSeconds: 12 } },
        order: [],
      })
    );
    await store.load();
    store.addTransit('10:20', transit());
    await store.flush();
    expect((await readBack()).overrides).toEqual({
      'imsa:20': { fourTyreSeconds: 12 },
    });
  });

  it('loads and keeps learning from a file larger than the old 8 MiB limit', async () => {
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        transit: { '10:20': [transit()] },
        service: {},
        order: ['transit|10:20'],
        padding: 'x'.repeat(10 * 1024 * 1024),
      })
    );
    await store.load();
    expect(store.read().transit['10:20']).toHaveLength(1);
    store.addTransit('10:20', transit(2));
    await store.flush();
    expect((await readBack()).transit['10:20']).toHaveLength(2);
  });

  it('drops the oldest keys so a save near the size limit still loads, keeping overrides', async () => {
    const limit = 64 * 1024;
    const overrides = { 'imsa:20': { fourTyreSeconds: 12 } };
    await writeFile(
      file,
      JSON.stringify({ version: 1, transit: {}, service: {}, overrides })
    );
    const sized = new PitStopModelStore(file, limit);
    await sized.load();
    for (let key = 0; key < 40; key++) {
      for (let i = 0; i < MAX_SAMPLES_PER_KEY; i++) {
        sized.addTransit(`${key}:1`, transit(i));
      }
    }
    await sized.flush();
    expect((await stat(file)).size).toBeLessThanOrEqual(limit);

    const reloaded = new PitStopModelStore(file, limit);
    await reloaded.load();
    const data = reloaded.read();
    expect(data.overrides).toEqual(overrides);
    expect(data.transit['39:1']).toHaveLength(MAX_SAMPLES_PER_KEY);
    expect(data.transit['0:1']).toBeUndefined();
    reloaded.addTransit('40:1', transit());
    await reloaded.flush();
    expect((await readBack()).transit['40:1']).toHaveLength(1);
  });

  it('keeps the existing file when the overrides alone exceed the size limit', async () => {
    const original = JSON.stringify({
      version: 1,
      transit: {},
      service: {},
      overrides: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `s${i}:1`,
          { fourTyreSeconds: i },
        ])
      ),
    });
    await writeFile(file, original);
    const sized = new PitStopModelStore(file, original.length + 100);
    await sized.load();
    sized.addTransit('10:20', transit());
    await sized.flush();
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('pauses learning rather than overwrite a broken file', async () => {
    await writeFile(file, '{ not json');
    await store.load();
    store.addTransit('10:20', transit());
    await store.flush();
    expect(await readFile(file, 'utf8')).toBe('{ not json');
  });
});

describe('parsePitStopModel', () => {
  it('drops invalid samples and keeps valid ones', () => {
    const result = parsePitStopModel({
      version: 1,
      transit: { '10:20': [transit(), { at: 'x' }] },
      service: { 'default:20': 'nope' },
      overrides: {},
      order: ['transit|10:20', 'transit|gone'],
    });
    expect(result.writable).toBe(true);
    expect(result.droppedSamples).toBe(2);
    expect(result.data.transit['10:20']).toHaveLength(1);
    expect(result.data.order).toEqual(['transit|10:20']);
  });

  it('ignores repeated order entries, so they cannot push out real keys', () => {
    const result = parsePitStopModel({
      version: 1,
      transit: { a: [transit()], b: [transit()] },
      service: {},
      order: ['transit|a', ...Array.from({ length: 1001 }, () => 'transit|b')],
    });
    expect(Object.keys(result.data.transit).sort()).toEqual(['a', 'b']);
    expect(result.data.order).toEqual(['transit|a', 'transit|b']);
  });

  it('accepts an overhead override and samples with the time stopped', () => {
    const result = parsePitStopModel({
      version: 1,
      service: { 'default:20': [{ ...service(), stationarySeconds: 9.6 }] },
      overrides: { 'default:20': { overheadSeconds: 2 } },
    });
    expect(result.writable).toBe(true);
    expect(result.data.service['default:20'][0].stationarySeconds).toBe(9.6);
  });

  it('is read-only when an override is invalid or the version is unknown', () => {
    expect(
      parsePitStopModel({
        version: 1,
        overrides: { 'imsa:20': { fourTyreSeconds: 'fast' } },
      }).writable
    ).toBe(false);
    expect(
      parsePitStopModel({ version: 1, overrides: { a: { other: 1 } } }).writable
    ).toBe(false);
    expect(parsePitStopModel({ version: 2 }).writable).toBe(false);
  });
});
