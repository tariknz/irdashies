import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readRadarPoleSideReportHash,
  writeRadarPoleSideReportHash,
} from './radarPoleSideReportHash';

let userData = '';
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('radarPoleSideReportHash storage', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pole-side-hash-'));
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('has no hash before the first report', async () => {
    expect(await readRadarPoleSideReportHash()).toBeUndefined();
  });

  it('reads back the hash it wrote', async () => {
    await writeRadarPoleSideReportHash('a'.repeat(64));

    expect(await readRadarPoleSideReportHash()).toBe('a'.repeat(64));
  });

  it('does not throw when the folder is gone', async () => {
    userData = path.join(userData, 'gone');

    await expect(
      writeRadarPoleSideReportHash('a'.repeat(64))
    ).resolves.toBeUndefined();
    expect(await readRadarPoleSideReportHash()).toBeUndefined();
  });
});
