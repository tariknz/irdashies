import fsp, { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  vi.restoreAllMocks();
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

  it('starts a new line when the existing file does not end with one', async () => {
    await writeFile(file, JSON.stringify(report(1)));
    const log = new PitStopReportLog(file);
    await log.append(report(2));
    await log.append(report(3));
    expect(await readLines()).toEqual([1, 2, 3]);
  });

  it('keeps only the newest reports past the cap', async () => {
    const log = new PitStopReportLog(file, 3);
    for (let at = 1; at <= 5; at++) void log.append(report(at));
    await log.flush();
    expect(await readLines()).toEqual([3, 4, 5]);
  });

  it('starts the next report on its own line after a write fails part way', async () => {
    const log = new PitStopReportLog(file);
    await log.append(report(1));
    vi.spyOn(fsp, 'appendFile').mockImplementationOnce(async () => {
      await writeFile(file, `${JSON.stringify(report(1))}\n{"at":2,"tr`);
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    });
    await log.append(report(2));
    await log.append(report(3));
    const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
    expect(lines).toEqual([
      JSON.stringify(report(1)),
      '{"at":2,"tr',
      JSON.stringify(report(3)),
    ]);
  });

  it('retries a failed trim on flush without adding the report again', async () => {
    const log = new PitStopReportLog(file, 2);
    await log.append(report(1));
    await log.append(report(2));
    vi.spyOn(fsp, 'rename').mockRejectedValueOnce(
      Object.assign(new Error('locked'), { code: 'EPERM' })
    );
    await log.append(report(3));
    expect(await readLines()).toEqual([1, 2, 3]);
    await log.flush();
    expect(await readLines()).toEqual([2, 3]);
  });
});
