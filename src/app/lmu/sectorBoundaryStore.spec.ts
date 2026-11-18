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

  it('parses the persisted data once and keeps it', () => {
    const read = vi.fn(() => ({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    }));
    const store = new LmuSectorBoundaryStore({ read, write: vi.fn() });

    store.get('1000123');
    store.get('1000999');
    store.snapshot();

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('answers nothing and writes nothing before the data is read', () => {
    const read = vi.fn<() => unknown>(() => undefined);
    const write = vi.fn<(records: LmuSectorBoundaryRecords) => void>();
    const store = new LmuSectorBoundaryStore({ read, write });

    expect(store.get('1000123')).toBeNull();
    expect(store.snapshot()).toEqual({});
    store.record('1000999', [0.39, 0.79]);
    expect(write).not.toHaveBeenCalled();

    read.mockReturnValue({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
    expect(store.snapshot()).toEqual({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });
  });

  it('finds only stored track ids, never a property every object has', () => {
    const { store } = storeWith(
      JSON.parse(
        '{"__proto__":{"s2StartPct":0.39,"s3StartPct":0.79},"1000123":{"s2StartPct":0.39,"s3StartPct":0.79}}'
      )
    );

    for (const key of [
      'constructor',
      '__proto__',
      'toString',
      'hasOwnProperty',
    ]) {
      expect(store.get(key)).toBeNull();
    }
    expect(Object.keys(store.snapshot())).toEqual(['1000123']);
  });

  it('hands out a copy that cannot change what it stores', () => {
    const { store } = storeWith({
      '1000123': { s2StartPct: 0.39, s3StartPct: 0.79 },
    });

    const snapshot = store.snapshot();
    snapshot['1000123'].s2StartPct = 0.5;
    delete snapshot['1000123'];

    expect(store.get('1000123')).toEqual([0.39, 0.79]);
  });
});
