import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const FILE = 'radar-pole-side-overrides.json';

const loadModule = async () => {
  vi.resetModules();
  return import('./radarPoleSideOverrides');
};

describe('radarPoleSideOverrides storage', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pole-side-'));
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('starts empty without a file', async () => {
    const storage = await loadModule();

    expect(await storage.loadRadarPoleSideOverrides()).toBe(true);
    expect(storage.radarPoleSideOverrides.snapshot()).toEqual({});
  });

  it('reads the file once, before anything looks a correction up', async () => {
    fs.writeFileSync(
      path.join(userData, FILE),
      JSON.stringify({ '95': { start: false, table: true } })
    );
    const storage = await loadModule();
    await storage.loadRadarPoleSideOverrides();
    fs.writeFileSync(path.join(userData, FILE), '{}');
    await storage.loadRadarPoleSideOverrides();

    expect(storage.radarPoleSideOverrides.override(95, 'start')).toBe(false);
  });

  it('writes a flip when flushed', async () => {
    const storage = await loadModule();
    await storage.loadRadarPoleSideOverrides();
    storage.radarPoleSideOverrides.setTrack(95, true, 'start');
    storage.radarPoleSideOverrides.flip();

    await storage.flushRadarPoleSideOverrides();

    expect(
      JSON.parse(fs.readFileSync(path.join(userData, FILE), 'utf8'))
    ).toEqual({ '95': { start: false, table: true } });
  });

  it('flushes a correction whose write failed', async () => {
    const storage = await loadModule();
    await storage.loadRadarPoleSideOverrides();
    const gone = path.join(userData, 'later');
    userData = gone;
    storage.radarPoleSideOverrides.setTrack(95, true, 'start');
    storage.radarPoleSideOverrides.flip();
    await storage.flushRadarPoleSideOverrides();
    expect(fs.existsSync(path.join(gone, FILE))).toBe(false);

    fs.mkdirSync(gone);
    await storage.flushRadarPoleSideOverrides();

    expect(fs.existsSync(path.join(gone, FILE))).toBe(true);
    fs.rmSync(gone, { recursive: true, force: true });
  });

  it('never replaces a file it could not read', async () => {
    // A directory where the file should be: reading fails with EISDIR.
    fs.mkdirSync(path.join(userData, FILE));
    const storage = await loadModule();

    expect(await storage.loadRadarPoleSideOverrides()).toBe(false);
    storage.radarPoleSideOverrides.setTrack(95, true, 'start');
    storage.radarPoleSideOverrides.flip();
    await storage.flushRadarPoleSideOverrides();

    expect(fs.statSync(path.join(userData, FILE)).isDirectory()).toBe(true);
  });

  it('moves an invalid file aside and starts empty', async () => {
    fs.writeFileSync(path.join(userData, FILE), '{oops');
    const storage = await loadModule();

    expect(await storage.loadRadarPoleSideOverrides()).toBe(true);
    expect(storage.radarPoleSideOverrides.snapshot()).toEqual({});
    expect(fs.existsSync(path.join(userData, `${FILE}.invalid`))).toBe(true);
  });
});
