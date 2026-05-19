import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn(() => true));
const mockUnlinkSync = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    unlinkSync: mockUnlinkSync,
  },
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}));

const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  default: { writeFile: mockWriteFile },
  writeFile: mockWriteFile,
}));

import {
  getReferenceLap,
  saveReferenceLap,
  flushReferenceLapsOnShutdown,
  __awaitPendingWrite,
  __resetForTests,
} from './referenceLaps';
import type { ReferenceLap } from '@irdashies/types';

const makeLap = (finishTime: number): ReferenceLap => ({
  startTime: 0,
  finishTime,
  times: new Float32Array([0.1, 0.2]),
  pointPos: new Float32Array([0.0, 0.5]),
  tangents: new Float32Array([1.0, 1.0]),
  interval: 0.0025,
  pointsCount: 2,
  lastTrackedPct: 1.0,
  isCleanLap: true,
});

describe('referenceLaps storage', () => {
  beforeEach(() => {
    __resetForTests();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockWriteFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  describe('getReferenceLap', () => {
    it('returns null when no data is on disk', () => {
      expect(getReferenceLap(1, 2, 3)).toBeNull();
    });

    it('reads from disk only on first call (cache hit on subsequent reads)', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          '1_2_3': {
            ...makeLap(60),
            times: Array.from(makeLap(60).times),
            pointPos: Array.from(makeLap(60).pointPos),
            tangents: Array.from(makeLap(60).tangents),
          },
        })
      );

      const a = getReferenceLap(1, 2, 3);
      const b = getReferenceLap(1, 2, 3);
      const c = getReferenceLap(99, 99, 99);

      expect(a?.finishTime).toBe(60);
      expect(b?.finishTime).toBe(60);
      expect(c).toBeNull();
      // Disk read happens once across three lookups.
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('revives Float32Arrays for stored array fields', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          '1_2_3': {
            ...makeLap(60),
            times: [0.1, 0.2],
            pointPos: [0.0, 0.5],
            tangents: [1.0, 1.0],
          },
        })
      );

      const lap = getReferenceLap(1, 2, 3);
      expect(lap?.times).toBeInstanceOf(Float32Array);
      expect(lap?.pointPos).toBeInstanceOf(Float32Array);
      expect(lap?.tangents).toBeInstanceOf(Float32Array);
    });
  });

  describe('saveReferenceLap', () => {
    it('updates the cache so subsequent reads see the new value immediately', () => {
      saveReferenceLap(1, 2, 3, makeLap(60));

      const lap = getReferenceLap(1, 2, 3);
      expect(lap?.finishTime).toBe(60);
      // No sync write happened.
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('debounces multiple saves into a single async file write', async () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 3, makeLap(60));

      // Within the debounce window: no write yet.
      expect(mockWriteFile).not.toHaveBeenCalled();

      await __awaitPendingWrite();

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('writes the latest value when multiple distinct saves coalesce', async () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 3, makeLap(58));
      saveReferenceLap(1, 2, 3, makeLap(57));

      await __awaitPendingWrite();

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written['1_2_3'].finishTime).toBe(57);
    });

    it('writes a separate entry per (series, track, class) key', async () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 4, makeLap(70));

      await __awaitPendingWrite();

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written['1_2_3'].finishTime).toBe(60);
      expect(written['1_2_4'].finishTime).toBe(70);
    });
  });

  describe('flushReferenceLapsOnShutdown', () => {
    it('writes any pending data synchronously', () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      flushReferenceLapsOnShutdown();

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written['1_2_3'].finishTime).toBe(60);
    });

    it('is a no-op when no save has happened (cache never loaded)', () => {
      flushReferenceLapsOnShutdown();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('post-debounce write log', () => {
    it('logs exactly once per actual file write, regardless of save count', async () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 3, makeLap(58));
      saveReferenceLap(1, 2, 3, makeLap(57));

      await __awaitPendingWrite();

      const writeLogs = mockLoggerInfo.mock.calls.filter((call) =>
        (call[0] as string).startsWith('[Main] Reference laps written to disk')
      );
      expect(writeLogs).toHaveLength(1);
      expect(writeLogs[0][0]).toBe(
        '[Main] Reference laps written to disk (1 entries)'
      );
    });

    it('reports the number of cache entries written', async () => {
      saveReferenceLap(1, 2, 3, makeLap(60));
      saveReferenceLap(1, 2, 4, makeLap(70));
      saveReferenceLap(9, 9, 9, makeLap(80));

      await __awaitPendingWrite();

      const writeLogs = mockLoggerInfo.mock.calls.filter((call) =>
        (call[0] as string).startsWith('[Main] Reference laps written to disk')
      );
      expect(writeLogs[0][0]).toBe(
        '[Main] Reference laps written to disk (3 entries)'
      );
    });

    it('does not log a write line when the underlying writeFile fails', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('disk full'));
      saveReferenceLap(1, 2, 3, makeLap(60));

      await __awaitPendingWrite();

      const writeLogs = mockLoggerInfo.mock.calls.filter((call) =>
        (call[0] as string).startsWith('[Main] Reference laps written to disk')
      );
      expect(writeLogs).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });
});
