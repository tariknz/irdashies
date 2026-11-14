import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitStopsSnapshot } from '@irdashies/types';
import { usePitStopData } from './usePitStopData';

const mocks = vi.hoisted(() => ({
  snapshot: null as PitStopsSnapshot | null,
  standingsByClass: [] as unknown[],
}));

vi.mock('@irdashies/context', () => ({
  usePitStopsSnapshot: () => mocks.snapshot,
  useSessionDrivers: () => [],
}));
vi.mock('../../hooks/useGantrySessionData', () => ({
  useGantrySessionData: () => ({ standingsByClass: mocks.standingsByClass }),
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
});
