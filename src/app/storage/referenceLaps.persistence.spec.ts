import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ReferenceLap } from '../../types';
const { directory } = vi.hoisted(() => ({
  directory: `/tmp/irdashies-reference-persistence-${process.pid}`,
}));
vi.mock('electron', () => ({ app: { getPath: () => directory } }));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./storage', () => ({ readData: vi.fn(() => '1.0.0') }));
import {
  __resetForTests,
  saveReferenceLap,
  getReferenceLap,
  flushReferenceLapsOnShutdown,
  validateReferenceLapFile,
} from './referenceLaps';
import { getStorageStatus, reportStorageResult } from './storageStatus';
const file = path.join(directory, 'referenceLaps.json');
const lap = (finishTime: number): ReferenceLap => ({
  startTime: 0,
  finishTime,
  times: new Float32Array([0, 1]),
  pointPos: new Float32Array([0, 1]),
  tangents: new Float32Array([1, 1]),
  interval: 0.0025,
  pointsCount: 2,
  lastTrackedPct: 1,
  isCleanLap: true,
});
let previous: string;

beforeEach(async () => {
  __resetForTests();
  reportStorageResult('referenceLaps');
  await fsp.mkdir(directory, { recursive: true });
  previous = JSON.stringify({ '1_2_3': lap(60), version: '1.0.0' });
  await fsp.writeFile(file, previous);
});
afterEach(async () => {
  __resetForTests();
  vi.restoreAllMocks();
  await fsp.rm(directory, { recursive: true, force: true });
});

it.each(['writeFile', 'rename'] as const)(
  'keeps prior reference laps after ENOSPC in %s, retains new lap in memory and recovers',
  async (operation) => {
    vi.spyOn(fsp, operation).mockRejectedValueOnce(
      Object.assign(new Error('full'), { code: 'ENOSPC' })
    );
    saveReferenceLap(1, 2, 3, lap(58));
    await flushReferenceLapsOnShutdown();
    expect(await fsp.readFile(file, 'utf8')).toBe(previous);
    expect(getReferenceLap(1, 2, 3)?.finishTime).toBe(58);
    expect(getStorageStatus().diskFull).toBe(true);
    expect(await fsp.readdir(directory)).toEqual(['referenceLaps.json']);
    await flushReferenceLapsOnShutdown();
    expect(
      JSON.parse(await fsp.readFile(file, 'utf8'))['1_2_3'].finishTime
    ).toBe(58);
    expect(getStorageStatus().diskFull).toBe(false);
  }
);

it('retains the migration marker across saves and startup, so the next launch keeps valid laps', async () => {
  saveReferenceLap(1, 2, 3, lap(57));
  await flushReferenceLapsOnShutdown();
  __resetForTests();
  validateReferenceLapFile();
  expect(getReferenceLap(1, 2, 3)?.finishTime).toBe(57);
  expect(JSON.parse(await fsp.readFile(file, 'utf8')).version).toBe('1.0.0');
});

it('caps reference contexts, keeping the most recently saved lap', async () => {
  for (let i = 0; i <= 500; i++) saveReferenceLap(1, i, 3, lap(60));
  await flushReferenceLapsOnShutdown();
  const stored = JSON.parse(await fsp.readFile(file, 'utf8'));
  expect(Object.keys(stored).filter((key) => key !== 'version')).toHaveLength(
    500
  );
  expect(getReferenceLap(1, 0, 3)).toBeNull();
  expect(getReferenceLap(1, 500, 3)?.finishTime).toBe(60);
});
