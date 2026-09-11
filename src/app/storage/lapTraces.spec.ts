import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/user/data') },
}));

const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  default: { readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync },
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  default: { writeFile: mockWriteFile },
  writeFile: mockWriteFile,
}));

import {
  getLapTrace,
  saveLapTrace,
  clearLapTrace,
  flushLapTracesOnShutdown,
  __awaitPendingLapTraceWrite,
  __resetLapTracesForTests,
} from './lapTraces';
import type { LapTraceRecord } from '@irdashies/types';

const makeRecord = (
  overrides: Partial<LapTraceRecord> = {}
): LapTraceRecord => ({
  schemaVersion: 2,
  source: { kind: 'best', label: 'Personal Best', importedAt: 1000 },
  trackId: 1,
  trackConfigName: 'Grand Prix',
  carPath: 'car1',
  trackLengthM: 20,
  lapTimeSec: 90.123,
  samples: {
    length: 4,
    distanceM: Float32Array.from([0, 5.25, 10.5, 15.75]),
    timeSec: Float32Array.from([0, 0.1234, 0.2468, 0.3702]),
    throttle: Float32Array.from([0.34, 1, 0, 0.5]),
    brake: Float32Array.from([0, 0, 1, 0.25]),
    speed: Float32Array.from([40.55, 60, 20, 30]),
    gear: Float32Array.from([3, 4, 2, 3]),
    absActive: Float32Array.from([0, 0, 1, 0]),
  },
  recordedAt: 1000,
  ...overrides,
});

describe('lapTraces storage', () => {
  beforeEach(() => {
    __resetLapTracesForTests();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockWriteFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  it('returns null when nothing is stored', () => {
    expect(getLapTrace(1, 'car1', 'best')).toBeNull();
  });

  it('returns null when the file is unreadable rather than throwing', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(() => getLapTrace(1, 'car1', 'best')).not.toThrow();
    expect(getLapTrace(1, 'car1', 'best')).toBeNull();
  });

  it('reads the file only once across many lookups', () => {
    getLapTrace(1, 'car1', 'best');
    getLapTrace(2, 'car2', 'best');
    getLapTrace(3, 'car3', 'manual');
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it('makes a saved lap visible immediately', () => {
    const record = makeRecord();
    saveLapTrace(1, 'car1', 'best', record);
    expect(getLapTrace(1, 'car1', 'best')).toBe(record);
  });

  it('keys laps by source so the three can coexist', () => {
    saveLapTrace(1, 'car1', 'best', makeRecord({ lapTimeSec: 90 }));
    saveLapTrace(1, 'car1', 'manual', makeRecord({ lapTimeSec: 88 }));

    expect(getLapTrace(1, 'car1', 'best')?.lapTimeSec).toBe(90);
    expect(getLapTrace(1, 'car1', 'manual')?.lapTimeSec).toBe(88);
    expect(getLapTrace(1, 'car1', 'garage61')).toBeNull();
  });

  it('keys laps by car so two cars on one track do not collide', () => {
    saveLapTrace(1, 'car1', 'best', makeRecord({ lapTimeSec: 90 }));
    saveLapTrace(1, 'car2', 'best', makeRecord({ lapTimeSec: 100 }));

    expect(getLapTrace(1, 'car1', 'best')?.lapTimeSec).toBe(90);
    expect(getLapTrace(1, 'car2', 'best')?.lapTimeSec).toBe(100);
  });

  it('removes a lap on clear', () => {
    saveLapTrace(1, 'car1', 'best', makeRecord());
    clearLapTrace(1, 'car1', 'best');
    expect(getLapTrace(1, 'car1', 'best')).toBeNull();
  });

  it('collapses a burst of saves into one write', async () => {
    saveLapTrace(1, 'car1', 'best', makeRecord());
    saveLapTrace(2, 'car1', 'best', makeRecord());
    saveLapTrace(3, 'car1', 'best', makeRecord());

    await __awaitPendingLapTraceWrite();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('flushes synchronously on shutdown', () => {
    saveLapTrace(1, 'car1', 'best', makeRecord());
    flushLapTracesOnShutdown();
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it('quantises samples so Float32 noise does not bloat the file', async () => {
    saveLapTrace(1, 'car1', 'best', makeRecord());
    await __awaitPendingLapTraceWrite();

    const written = mockWriteFile.mock.calls[0][1] as string;
    // Float32 stores 0.34 as 0.3400000035762787 — that must not reach disk.
    expect(written).not.toContain('0.3400000');
    expect(written).toContain('0.34');
  });

  it('round-trips every sample array through disk as Float32Array', () => {
    saveLapTrace(1, 'car1', 'best', makeRecord());
    flushLapTracesOnShutdown();
    const written = mockWriteFileSync.mock.calls[0][1] as string;

    __resetLapTracesForTests();
    mockReadFileSync.mockReturnValue(written);

    const loaded = getLapTrace(1, 'car1', 'best');
    const samples = loaded?.samples;
    expect(samples?.length).toBe(4);
    for (const field of [
      'distanceM',
      'timeSec',
      'throttle',
      'brake',
      'speed',
      'gear',
      'absActive',
    ] as const) {
      expect(samples?.[field]).toBeInstanceOf(Float32Array);
    }
    expect(samples?.throttle[0]).toBeCloseTo(0.34, 3);
    expect(samples?.speed[0]).toBeCloseTo(40.55, 2);
    expect(Array.from(samples?.gear ?? [])).toEqual([3, 4, 2, 3]);
    expect(loaded?.lapTimeSec).toBe(90.123);
  });

  it('keeps distance to the centimetre and time to 0.1 ms', () => {
    // Corner deltas are differences of two timeSec values shown to 10 ms, and
    // brake points are interpolated from distanceM — both must survive disk.
    saveLapTrace(1, 'car1', 'best', makeRecord());
    flushLapTracesOnShutdown();
    const written = mockWriteFileSync.mock.calls[0][1] as string;

    __resetLapTracesForTests();
    mockReadFileSync.mockReturnValue(written);

    const samples = getLapTrace(1, 'car1', 'best')?.samples;
    expect(samples?.distanceM[1]).toBeCloseTo(5.25, 2);
    expect(samples?.timeSec[1]).toBeCloseTo(0.1234, 4);
    expect(samples?.timeSec[3]).toBeCloseTo(0.3702, 4);
  });

  it('discards records from another schema version on load', () => {
    const v2 = makeRecord();
    const v1 = { ...makeRecord({ trackId: 2 }), schemaVersion: 1 };
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ '1:car1:best': v2, '2:car1:best': v1 })
    );

    expect(getLapTrace(1, 'car1', 'best')?.trackId).toBe(1);
    expect(getLapTrace(2, 'car1', 'best')).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Discarded 1')
    );
  });

  it('prunes the oldest lap once the cap is reached', () => {
    for (let i = 0; i < 40; i++) {
      saveLapTrace(i, 'car1', 'best', makeRecord({ recordedAt: 5000 + i }));
    }
    // The oldest entry so far.
    expect(getLapTrace(0, 'car1', 'best')).not.toBeNull();

    saveLapTrace(999, 'car1', 'best', makeRecord({ recordedAt: 99999 }));

    expect(getLapTrace(0, 'car1', 'best')).toBeNull();
    expect(getLapTrace(999, 'car1', 'best')).not.toBeNull();
    expect(getLapTrace(20, 'car1', 'best')).not.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});
