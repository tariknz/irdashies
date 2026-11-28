import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Driver } from '@irdashies/types';
import { useBroadcastExcludedCarIdxs } from './useBroadcastExcludedCarIdxs';
import { EMPTY_EXCLUDED_IDXS } from './excludedCars';

const state = vi.hoisted(() => ({
  towerConfig: undefined as object | undefined,
  drivers: undefined as Driver[] | undefined,
}));

vi.mock('@irdashies/context', () => ({
  useSessionDrivers: () => state.drivers,
  useDashboard: () => ({
    currentDashboard: {
      widgets: [{ id: 'broadcast', enabled: true, config: state.towerConfig }],
    },
  }),
}));

const driver = (CarIdx: number, CarID: number) => ({ CarIdx, CarID }) as Driver;

describe('useBroadcastExcludedCarIdxs', () => {
  beforeEach(() => {
    state.drivers = [driver(0, 10), driver(1, 99), driver(2, 10)];
    state.towerConfig = { excludedCars: [{ carId: 99, name: 'Safety' }] };
  });

  it('returns the carIdxs driving an excluded model', () => {
    const { result } = renderHook(() => useBroadcastExcludedCarIdxs());
    expect([...result.current]).toEqual([1]);
  });

  it('returns the empty set when nothing is excluded or saved data is bad', () => {
    state.towerConfig = { excludedCars: 'nonsense' };
    const { result } = renderHook(() => useBroadcastExcludedCarIdxs());
    expect(result.current).toBe(EMPTY_EXCLUDED_IDXS);
  });

  it('keeps its identity while the roster and setting are unchanged', () => {
    const { result, rerender } = renderHook(() =>
      useBroadcastExcludedCarIdxs()
    );
    const first = result.current;
    state.towerConfig = { excludedCars: [{ carId: 99, name: 'Safety' }] };
    rerender();
    expect(result.current).toBe(first);
  });

  it('changes when the setting changes', () => {
    const { result, rerender } = renderHook(() =>
      useBroadcastExcludedCarIdxs()
    );
    state.towerConfig = {
      excludedCars: [
        { carId: 99, name: 'Safety' },
        { carId: 10, name: 'Other' },
      ],
    };
    rerender();
    expect([...result.current].sort()).toEqual([0, 1, 2]);
  });
});
