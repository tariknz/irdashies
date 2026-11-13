import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
