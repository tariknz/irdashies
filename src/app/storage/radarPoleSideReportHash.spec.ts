import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('radarPoleSideReportHash storage', () => {
  let storage: typeof import('./radarPoleSideReportHash');

  beforeEach(async () => {
    userData = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'pole-side-hash-')
    );
    vi.resetModules();
    storage = await import('./radarPoleSideReportHash');
  });

  afterEach(async () => {
    await storage.flushRadarPoleSideReportHash();
    await fs.promises.rm(userData, { recursive: true, force: true });
  });

  it('has no hash before the first report', async () => {
    expect(await storage.readRadarPoleSideReportHash()).toBeUndefined();
  });

  it('reads back the hash it wrote, and keeps it in its own file', async () => {
    storage.writeRadarPoleSideReportHash('a'.repeat(64));

    expect(await storage.readRadarPoleSideReportHash()).toBe('a'.repeat(64));
    await storage.flushRadarPoleSideReportHash();
    expect(
      await fs.promises.readFile(
        path.join(userData, 'radar-pole-side-report-hash.txt'),
        'utf8'
      )
    ).toBe('a'.repeat(64));
  });

  it('does not throw when the folder is gone', async () => {
    userData = path.join(userData, 'gone');

    expect(() =>
      storage.writeRadarPoleSideReportHash('a'.repeat(64))
    ).not.toThrow();
    await expect(
      storage.flushRadarPoleSideReportHash()
    ).resolves.toBeUndefined();
  });
});
