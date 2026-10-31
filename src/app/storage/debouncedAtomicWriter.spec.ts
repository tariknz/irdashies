import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';
import { createBeforeQuitHandler } from '../shutdownCoordinator';

let directory: string;
let filePath: string;
let payload: string;
let writer: ReturnType<typeof createDebouncedAtomicWriter>;
const onError = vi.fn();
const onSuccess = vi.fn();
const errno = (code: string) => Object.assign(new Error(code), { code });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'irdashies-storage-'));
  filePath = path.join(directory, 'data.json');
  await fsp.writeFile(filePath, '{"previous":true}');
  payload = '{"latest":1}';
  onError.mockReset();
  onSuccess.mockReset();
  writer = createDebouncedAtomicWriter({
    filePath,
    serialize: () => payload,
    onError,
    onSuccess,
  });
});

afterEach(async () => {
  writer.cancel();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fsp.rm(directory, { recursive: true, force: true });
});

it('coalesces saves for 250ms and replaces the previous file with the latest JSON', async () => {
  const write = vi.spyOn(fsp, 'writeFile');
  writer.schedule();
  payload = '{"latest":2}';
  writer.schedule();
  vi.advanceTimersByTime(249);
  expect(write).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  await writer.flush();
  expect(write).toHaveBeenCalledTimes(1);
  expect(await fsp.readFile(filePath, 'utf8')).toBe(payload);
  expect(await fsp.readdir(directory)).toEqual(['data.json']);
});

it('preserves valid data after a partial ENOSPC write, cleans the temp and recovers on a later save', async () => {
  const realWrite = fsp.writeFile.bind(fsp);
  const failure = errno('ENOSPC');
  vi.spyOn(fsp, 'writeFile').mockImplementationOnce(async (target) => {
    await realWrite(target, '{"partial":');
    throw failure;
  });
  writer.schedule();
  await writer.flush();
  expect(await fsp.readFile(filePath, 'utf8')).toBe('{"previous":true}');
  expect(await fsp.readdir(directory)).toEqual(['data.json']);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(onSuccess).not.toHaveBeenCalled();
  payload = '{"recovered":true}';
  writer.schedule();
  await writer.flush();
  expect(await fsp.readFile(filePath, 'utf8')).toBe(payload);
  expect(onSuccess).toHaveBeenCalledOnce();
});

it.each(['ENOSPC', 'EPERM', 'EEXIST'])(
  'preserves the destination when replacement fails with %s (including Windows locks)',
  async (code) => {
    vi.spyOn(fsp, 'rename').mockRejectedValueOnce(errno(code));
    const unlink = vi.spyOn(fsp, 'unlink');
    writer.schedule();
    await writer.flush();
    expect(await fsp.readFile(filePath, 'utf8')).toBe('{"previous":true}');
    expect(unlink).not.toHaveBeenCalledWith(filePath);
    expect(await fsp.readdir(directory)).toEqual(['data.json']);
    await writer.flush();
    expect(await fsp.readFile(filePath, 'utf8')).toBe(payload);
  }
);

it('does not repeatedly retry a full disk; a shutdown flush makes one final attempt', async () => {
  const write = vi.spyOn(fsp, 'writeFile').mockRejectedValue(errno('ENOSPC'));
  writer.schedule();
  vi.advanceTimersByTime(250);
  await tick();
  await tick();
  vi.advanceTimersByTime(3_600_000);
  expect(write).toHaveBeenCalledTimes(1);
  await writer.flush();
  expect(write).toHaveBeenCalledTimes(2);
});

it('bounds work during a slow write and flushes the latest change in order', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const realWrite = fsp.writeFile.bind(fsp);
  const write = vi
    .spyOn(fsp, 'writeFile')
    .mockImplementationOnce(async (...args) => {
      await gate;
      await realWrite(...args);
    });
  writer.schedule();
  vi.advanceTimersByTime(250);
  for (let i = 2; i <= 100; i++) {
    payload = JSON.stringify({ latest: i });
    writer.schedule();
    vi.advanceTimersByTime(250);
  }
  const flush = writer.flush();
  expect(write).toHaveBeenCalledTimes(1);
  release();
  await flush;
  expect(write).toHaveBeenCalledTimes(2);
  expect(await fsp.readFile(filePath, 'utf8')).toBe('{"latest":100}');
});

it('keeps before-quit pending until the debounced data has reached disk', async () => {
  writer.schedule();
  let complete!: () => void;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const quit = vi.fn(complete);
  const handler = createBeforeQuitHandler({
    prepareToQuit: vi.fn(),
    shutdown: () => writer.flush(),
    quit,
    reportFailure: vi.fn(),
    timeoutMs: 5000,
  });
  const preventDefault = vi.fn();
  handler({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(quit).not.toHaveBeenCalled();
  await finished;
  expect(await fsp.readFile(filePath, 'utf8')).toBe(payload);
});
