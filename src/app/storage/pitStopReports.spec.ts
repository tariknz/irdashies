import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitStopReport } from '@irdashies/types';
import { PitStopReportLog } from './pitStopReports';

vi.mock('electron', () => ({ app: { getPath: () => '/mock/userData' } }));
vi.mock('../logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

const report = (at: number) => ({ at, trackId: 1 }) as PitStopReport;

let directory: string;
let file: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'irdashies-pit-reports-'));
  file = path.join(directory, 'pitStopReports.jsonl');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const readLines = async () =>
  (await readFile(file, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line).at);

describe('PitStopReportLog', () => {
  it('appends one JSON line per stop', async () => {
    const log = new PitStopReportLog(file);
    void log.append(report(1));
    await log.append(report(2));
    expect(await readLines()).toEqual([1, 2]);
  });

  it('keeps an existing file and adds to it', async () => {
    await writeFile(file, `${JSON.stringify(report(1))}\n`);
    const log = new PitStopReportLog(file);
    await log.append(report(2));
    expect(await readLines()).toEqual([1, 2]);
  });

  it('keeps only the newest reports past the cap', async () => {
    const log = new PitStopReportLog(file, 3);
    for (let at = 1; at <= 5; at++) void log.append(report(at));
    await log.flush();
    expect(await readLines()).toEqual([3, 4, 5]);
  });
});
