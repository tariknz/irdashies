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

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile, writeFile: mockWriteFile },
  readFile: mockReadFile,
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
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
  });

  it('returns null when nothing is stored', async () => {
    expect(await getLapTrace(1, 'car1', 'best')).toBeNull();
  });

  it('returns null when the file is unreadable rather than throwing', async () => {
    mockReadFile.mockRejectedValue(new Error('EACCES'));
    await expect(getLapTrace(1, 'car1', 'best')).resolves.toBeNull();
  });

  it('reads the file only once across many lookups', async () => {
    await getLapTrace(1, 'car1', 'best');
    await getLapTrace(2, 'car2', 'best');
    await getLapTrace(3, 'car3', 'manual');
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('reads the file once for a burst of concurrent lookups', async () => {
    // Every caller that arrives while the first read is in flight shares it,
    // so enabling the widget and opening Settings together cannot read and
    // parse the file twice.
    await Promise.all([
      getLapTrace(1, 'car1', 'best'),
      getLapTrace(2, 'car2', 'best'),
      getLapTrace(3, 'car3', 'manual'),
    ]);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('makes a saved lap visible immediately', async () => {
    const record = makeRecord();
    await saveLapTrace(1, 'car1', 'best', record);
    expect(await getLapTrace(1, 'car1', 'best')).toBe(record);
  });

  it('keys laps by source so the three can coexist', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord({ lapTimeSec: 90 }));
    await saveLapTrace(1, 'car1', 'manual', makeRecord({ lapTimeSec: 88 }));

    expect((await getLapTrace(1, 'car1', 'best'))?.lapTimeSec).toBe(90);
    expect((await getLapTrace(1, 'car1', 'manual'))?.lapTimeSec).toBe(88);
    expect(await getLapTrace(1, 'car1', 'garage61')).toBeNull();
  });

  it('keys laps by car so two cars on one track do not collide', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord({ lapTimeSec: 90 }));
    await saveLapTrace(1, 'car2', 'best', makeRecord({ lapTimeSec: 100 }));

    expect((await getLapTrace(1, 'car1', 'best'))?.lapTimeSec).toBe(90);
    expect((await getLapTrace(1, 'car2', 'best'))?.lapTimeSec).toBe(100);
  });

  it('removes a lap on clear', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await clearLapTrace(1, 'car1', 'best');
    expect(await getLapTrace(1, 'car1', 'best')).toBeNull();
  });

  it('collapses a burst of saves into one write', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await saveLapTrace(2, 'car1', 'best', makeRecord());
    await saveLapTrace(3, 'car1', 'best', makeRecord());

    await __awaitPendingLapTraceWrite();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('flushes the pending write on shutdown', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await flushLapTracesOnShutdown();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('writes the latest cache last when shutdown meets a write in flight', async () => {
    // A slow write, already running when the app quits.
    let releaseFirst: (() => void) | undefined;
    mockWriteFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = () => resolve();
        })
    );
    await saveLapTrace(1, 'car1', 'best', makeRecord({ lapTimeSec: 90 }));
    // Let the debounce fire so that write is in flight.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    // One more lap lands, then the app quits.
    await saveLapTrace(2, 'car1', 'best', makeRecord({ lapTimeSec: 88 }));
    const shutdown = flushLapTracesOnShutdown();
    releaseFirst?.();
    await shutdown;

    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    // The last write to run is the one carrying both laps.
    const last = mockWriteFile.mock.calls[1][1] as string;
    expect(last).toContain('1:car1:best');
    expect(last).toContain('2:car1:best');
  });

  it('quantises samples so Float32 noise does not bloat the file', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await __awaitPendingLapTraceWrite();

    const written = mockWriteFile.mock.calls[0][1] as string;
    // Float32 stores 0.34 as 0.3400000035762787 — that must not reach disk.
    expect(written).not.toContain('0.3400000');
    expect(written).toContain('0.34');
  });

  it('round-trips every sample array through disk as Float32Array', async () => {
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await flushLapTracesOnShutdown();
    const written = mockWriteFile.mock.calls[0][1] as string;

    __resetLapTracesForTests();
    mockReadFile.mockResolvedValue(written);

    const loaded = await getLapTrace(1, 'car1', 'best');
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

  it('keeps distance to the centimetre and time to 0.1 ms', async () => {
    // Corner deltas are differences of two timeSec values shown to 10 ms, and
    // brake points are interpolated from distanceM — both must survive disk.
    await saveLapTrace(1, 'car1', 'best', makeRecord());
    await flushLapTracesOnShutdown();
    const written = mockWriteFile.mock.calls[0][1] as string;

    __resetLapTracesForTests();
    mockReadFile.mockResolvedValue(written);

    const samples = (await getLapTrace(1, 'car1', 'best'))?.samples;
    expect(samples?.distanceM[1]).toBeCloseTo(5.25, 2);
    expect(samples?.timeSec[1]).toBeCloseTo(0.1234, 4);
    expect(samples?.timeSec[3]).toBeCloseTo(0.3702, 4);
  });

  it('discards records from another schema version on load', async () => {
    const v2 = makeRecord();
    const v1 = { ...makeRecord({ trackId: 2 }), schemaVersion: 1 };
    mockReadFile.mockResolvedValue(
      JSON.stringify({ '1:car1:best': v2, '2:car1:best': v1 })
    );

    expect((await getLapTrace(1, 'car1', 'best'))?.trackId).toBe(1);
    expect(await getLapTrace(2, 'car1', 'best')).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Discarded 1')
    );
  });

  it('prunes the oldest lap once the cap is reached', async () => {
    for (let i = 0; i < 40; i++) {
      await saveLapTrace(
        i,
        'car1',
        'best',
        makeRecord({ recordedAt: 5000 + i })
      );
    }
    // The oldest entry so far.
    expect(await getLapTrace(0, 'car1', 'best')).not.toBeNull();

    await saveLapTrace(999, 'car1', 'best', makeRecord({ recordedAt: 99999 }));

    expect(await getLapTrace(0, 'car1', 'best')).toBeNull();
    expect(await getLapTrace(999, 'car1', 'best')).not.toBeNull();
    expect(await getLapTrace(20, 'car1', 'best')).not.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});
