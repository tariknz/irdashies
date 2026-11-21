import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../logger';
import { createReportHashFile } from './reportHashFile';

let userData = '';
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const HASH = 'a'.repeat(64);
const NEXT = 'b'.repeat(64);

describe('createReportHashFile', () => {
  let directory = '';
  let file: ReturnType<typeof createReportHashFile>;
  const filePath = () => path.join(directory, 'report-hash.txt');

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    directory = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'irdashies-report-hash-')
    );
    userData = directory;
    vi.mocked(logger.warn).mockClear();
    file = createReportHashFile('report-hash.txt', '[Report]');
  });

  afterEach(async () => {
    await file.flush();
    vi.restoreAllMocks();
    vi.useRealTimers();
    await fsp.rm(directory, { recursive: true, force: true });
  });

  it('has no hash before the first report', async () => {
    expect(await file.read()).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reads the stored hash without surrounding whitespace', async () => {
    await fsp.writeFile(filePath(), `${HASH}\n`);
    expect(await file.read()).toBe(HASH);
  });

  it('has no hash, and warns, when the file cannot be read', async () => {
    await fsp.mkdir(filePath());
    expect(await file.read()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      '[Report] Could not read report hash'
    );
  });

  it('writes once, 250 ms after the last hash, and only the latest', async () => {
    const write = vi.spyOn(fsp, 'writeFile');
    file.write(HASH);
    file.write(NEXT);
    vi.advanceTimersByTime(249);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await file.flush();
    expect(write).toHaveBeenCalledOnce();
    expect(await fsp.readFile(filePath(), 'utf8')).toBe(NEXT);
    expect(await fsp.readdir(directory)).toEqual(['report-hash.txt']);
  });

  it('reads back the hash it wrote before it reaches the file', async () => {
    await fsp.writeFile(filePath(), HASH);
    file.write(NEXT);
    expect(await file.read()).toBe(NEXT);
    expect(await fsp.readFile(filePath(), 'utf8')).toBe(HASH);
  });

  it('writes the pending hash at once when flushed', async () => {
    file.write(HASH);
    await file.flush();
    expect(await fsp.readFile(filePath(), 'utf8')).toBe(HASH);
  });

  it('creates no file when flushed with nothing written', async () => {
    await file.flush();
    expect(await fsp.readdir(directory)).toEqual([]);
  });

  it('keeps the previous hash when a write fails part way, and warns', async () => {
    await fsp.writeFile(filePath(), HASH);
    const realWrite = fsp.writeFile.bind(fsp);
    vi.spyOn(fsp, 'writeFile').mockImplementationOnce(async (target) => {
      await realWrite(target, NEXT.slice(0, 10));
      throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    });
    file.write(NEXT);
    await file.flush();
    expect(await fsp.readFile(filePath(), 'utf8')).toBe(HASH);
    expect(await fsp.readdir(directory)).toEqual(['report-hash.txt']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Report] Could not save report hash'
    );
  });

  it('does not throw when the folder is gone, and keeps the hash for this run', async () => {
    userData = path.join(directory, 'gone');
    file.write(HASH);
    await expect(file.flush()).resolves.toBeUndefined();
    expect(await file.read()).toBe(HASH);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Report] Could not save report hash'
    );
  });
});
