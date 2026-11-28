import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitStopsSnapshot } from '@irdashies/types';
import { usePitStopData } from './usePitStopData';

const mocks = vi.hoisted(() => ({
  snapshot: null as PitStopsSnapshot | null,
  standingsByClass: [] as unknown[],
  excludedCars: [] as unknown[],
}));

vi.mock('@irdashies/context', () => ({
  usePitStopsSnapshot: () => mocks.snapshot,
  useSessionDrivers: () => [],
}));
vi.mock('../../hooks/useGantrySessionData', () => ({
  useGantrySessionData: () => ({
    standingsByClass: mocks.standingsByClass,
    excludedCars: mocks.excludedCars,
  }),
}));
vi.mock('../../hooks/useGantrySettings', () => ({
  useGantrySettings: () => undefined,
}));
vi.mock('../../hooks/useGantrySessionHold', () => ({
  useHeld: <T>(value: T) => value,
}));

const snapshot = (version: number): PitStopsSnapshot => ({
  subSessionId: 1001,
  sessionNum: 0,
  sessionTime: 100,
  stops: [],
  version,
});

let clock = 0;

beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1000));
  mocks.snapshot = snapshot(1);
  mocks.standingsByClass = [];
  mocks.excludedCars = [];
});

afterEach(() => vi.restoreAllMocks());

describe('usePitStopData', () => {
  it('keeps the timer baseline until a new snapshot arrives', () => {
    const { result, rerender } = renderHook(() => usePitStopData());
    const first = result.current.receivedAt;

    mocks.standingsByClass = [];
    rerender();
    expect(result.current.receivedAt).toBe(first);

    mocks.snapshot = snapshot(2);
    rerender();
    expect(result.current.receivedAt).toBeGreaterThan(first);
  });

  it('drops the stops of excluded cars', () => {
    const stop = (id: number, carIdx: number) =>
      ({
        id,
        carIdx,
        kind: 'service',
        lap: 5,
        entryTime: 50,
        exitTime: 80,
        stallTime: 60,
        stallSeconds: 10,
        stallEnteredAt: null,
        classPositionIn: 2,
        classPositionOut: 3,
      }) as unknown as PitStopsSnapshot['stops'][number];
    mocks.snapshot = { ...snapshot(3), stops: [stop(1, 4), stop(2, 9)] };
    mocks.excludedCars = [{ carIdx: 9 }];

    const { result } = renderHook(() => usePitStopData());

    expect(result.current.rows.map((row) => row.stop.carIdx)).toEqual([4]);
  });
});
