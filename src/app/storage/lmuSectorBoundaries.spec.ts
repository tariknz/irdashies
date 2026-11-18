import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const exists = (file: string) =>
  fs.access(file).then(
    () => true,
    () => false
  );

const FILE = 'lmu-sector-boundaries.json';
const LAGUNA = { '694510461': { s2StartPct: 0.3904, s3StartPct: 0.7925 } };

const filePath = () => path.join(userData, FILE);
const readStored = async () =>
  JSON.parse(await fs.readFile(filePath(), 'utf8')) as unknown;

const busy = () => Object.assign(new Error('busy'), { code: 'EBUSY' });

const loadModule = async () => {
  vi.resetModules();
  return import('./lmuSectorBoundaries');
};

describe('lmuSectorBoundaries storage', () => {
  beforeEach(async () => {
    userData = await fs.mkdtemp(path.join(os.tmpdir(), 'lmu-sectors-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(userData, { recursive: true, force: true });
  });

  it('starts empty without a file', async () => {
    const storage = await loadModule();

    expect(await storage.loadLmuSectorBoundaries()).toBe(true);
    expect(storage.lmuSectorBoundaryStore.snapshot()).toEqual({});
  });

  it('reads the file once and serves what it holds', async () => {
    await fs.writeFile(filePath(), JSON.stringify(LAGUNA));
    const storage = await loadModule();
    await storage.loadLmuSectorBoundaries();
    await fs.writeFile(filePath(), '{}');
    await storage.loadLmuSectorBoundaries();

    expect(storage.lmuSectorBoundaryStore.get('694510461')).toEqual([
      0.3904, 0.7925,
    ]);
    expect(storage.lmuSectorBoundaryStore.snapshot()).toEqual(LAGUNA);
  });

  it('writes a measurement beside the stored ones when flushed', async () => {
    await fs.writeFile(filePath(), JSON.stringify(LAGUNA));
    const storage = await loadModule();
    await storage.loadLmuSectorBoundaries();
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);

    await storage.flushLmuSectorBoundaries();

    expect(await readStored()).toEqual({
      ...LAGUNA,
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
  });

  it('writes a measurement on its own after a short delay', async () => {
    const storage = await loadModule();
    await storage.loadLmuSectorBoundaries();
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);

    await vi.waitFor(async () => expect(await exists(filePath())).toBe(true));
    expect(await readStored()).toEqual({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
  });

  it('flushes nothing when nothing was measured', async () => {
    const storage = await loadModule();
    await storage.loadLmuSectorBoundaries();

    await storage.flushLmuSectorBoundaries();

    expect(await exists(filePath())).toBe(false);
  });

  it('never writes a measurement recorded before the file was read', async () => {
    await fs.writeFile(filePath(), JSON.stringify(LAGUNA));
    const storage = await loadModule();
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);
    await storage.flushLmuSectorBoundaries();

    expect(await readStored()).toEqual(LAGUNA);
    await storage.loadLmuSectorBoundaries();
    expect(storage.lmuSectorBoundaryStore.snapshot()).toEqual(LAGUNA);
  });

  it('keeps a measurement whose write failed for the next flush', async () => {
    const storage = await loadModule();
    await storage.loadLmuSectorBoundaries();
    const blocker = `${filePath()}.${process.pid}.tmp`;
    await fs.mkdir(blocker);
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);
    await storage.flushLmuSectorBoundaries();
    expect(await exists(filePath())).toBe(false);

    await fs.rm(blocker, { recursive: true, force: true });
    await storage.flushLmuSectorBoundaries();

    expect(await readStored()).toEqual({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
  });

  it('reads the file again when the first read fails for a moment', async () => {
    await fs.writeFile(filePath(), JSON.stringify(LAGUNA));
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(busy());
    const storage = await loadModule();

    expect(await storage.loadLmuSectorBoundaries()).toBe(true);
    expect(storage.lmuSectorBoundaryStore.snapshot()).toEqual(LAGUNA);
  });

  it('never replaces a file that stays unreadable', async () => {
    await fs.writeFile(filePath(), JSON.stringify(LAGUNA));
    vi.spyOn(fs, 'readFile')
      .mockRejectedValueOnce(busy())
      .mockRejectedValueOnce(busy());
    const storage = await loadModule();

    expect(await storage.loadLmuSectorBoundaries()).toBe(false);
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);
    await storage.flushLmuSectorBoundaries();

    expect(await readStored()).toEqual(LAGUNA);
  });

  it('never replaces a file it could not read', async () => {
    await fs.mkdir(filePath());
    const storage = await loadModule();

    expect(await storage.loadLmuSectorBoundaries()).toBe(false);
    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);
    await storage.flushLmuSectorBoundaries();

    expect((await fs.stat(filePath())).isDirectory()).toBe(true);
  });

  it('moves an invalid file aside, starts empty and saves afresh', async () => {
    await fs.writeFile(filePath(), '{oops');
    const storage = await loadModule();

    expect(await storage.loadLmuSectorBoundaries()).toBe(true);
    expect(storage.lmuSectorBoundaryStore.snapshot()).toEqual({});
    expect(await fs.readFile(`${filePath()}.invalid`, 'utf8')).toBe('{oops');

    storage.lmuSectorBoundaryStore.record('1000123', [0.39, 0.79]);
    await storage.flushLmuSectorBoundaries();
    expect(await readStored()).toEqual({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
  });
});
