import { describe, expect, it, vi } from 'vitest';
import {
  LmuSectorBoundaryStore,
  parseLmuSectorBoundaries,
  type LmuSectorBoundaryRecords,
} from './sectorBoundaryStore';

const storeWith = (raw: unknown) => {
  const write = vi.fn<(records: LmuSectorBoundaryRecords) => void>();
  return {
    store: new LmuSectorBoundaryStore({ read: () => raw, write }),
    write,
  };
};

describe('parseLmuSectorBoundaries', () => {
  it('keeps canonical track ids with plausible pairs only', () => {
    expect(
      parseLmuSectorBoundaries({
        '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
        '0123': { s2StartPct: 0.39, s3StartPct: 0.79 },
        laguna: { s2StartPct: 0.39, s3StartPct: 0.79 },
        '1000124': { s2StartPct: 0.79, s3StartPct: 0.39 },
        '1000125': { s2StartPct: 0.39, s3StartPct: 0.4 },
        '1000126': { s2StartPct: '0.39', s3StartPct: 0.79 },
        '1000127': null,
      })
    ).toEqual({ '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 } });
  });

  it('reads anything that is not an object as empty', () => {
    expect(parseLmuSectorBoundaries(null)).toEqual({});
    expect(parseLmuSectorBoundaries([1, 2])).toEqual({});
    expect(parseLmuSectorBoundaries('x')).toEqual({});
  });
});

describe('LmuSectorBoundaryStore', () => {
  it('returns a stored pair, or null for a track never measured', () => {
    const { store } = storeWith({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
    expect(store.get('1000123')).toEqual([0.39, 0.79]);
    expect(store.get('1000999')).toBeNull();
  });

  it('records a new measurement, rounded, and writes it', () => {
    const { store, write } = storeWith(null);
    store.record('1000123', [0.390412, 0.792549]);

    expect(store.get('1000123')).toEqual([0.3904, 0.7925]);
    expect(write).toHaveBeenCalledWith({
      '1000123': { s2StartPct: 0.3904, s3StartPct: 0.7925 },
    });
  });

  it('keeps the stored pair when a measurement finds the same lines', () => {
    const { store, write } = storeWith({
      '1000123': { s2StartPct: 0.3904, s3StartPct: 0.7925 },
    });
    store.record('1000123', [0.3909, 0.7921]);

    expect(write).not.toHaveBeenCalled();
    expect(store.get('1000123')).toEqual([0.3904, 0.7925]);
  });

  it('replaces the stored pair when a line has moved', () => {
    const { store, write } = storeWith({
      '1000123': { s2StartPct: 0.3904, s3StartPct: 0.7925 },
    });
    store.record('1000123', [0.3904, 0.8]);

    expect(write).toHaveBeenCalledTimes(1);
    expect(store.get('1000123')).toEqual([0.3904, 0.8]);
  });

  it('refuses a malformed id or an implausible pair', () => {
    const { store, write } = storeWith(null);
    store.record('laguna', [0.39, 0.79]);
    store.record('1000123', [0.79, 0.39]);

    expect(write).not.toHaveBeenCalled();
    expect(store.snapshot()).toEqual({});
  });
});
