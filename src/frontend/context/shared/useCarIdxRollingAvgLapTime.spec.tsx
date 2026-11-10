import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { useCarIdxRollingAvgLapTime } from './useCarIdxRollingAvgLapTime';

afterEach(() => useLapTimesStore.getState().reset());

describe('rolling average lap times', () => {
  it('averages the selected available laps and filters before choosing the window', () => {
    useLapTimesStore.getState().applySnapshot({
      lapTimes: [],
      lapTimeHistory: [[90, 91, 150, 130, 92], []],
      cleanLapTimeHistory: [[90, 91, 92], []],
      sessionNum: 2,
      version: 1,
    });
    const { result, rerender } = renderHook(
      ({ count, filter }) => useCarIdxRollingAvgLapTime(count, filter),
      { initialProps: { count: 3, filter: false } }
    );
    expect(result.current).toEqual([124, 0]);
    rerender({ count: 3, filter: true });
    expect(result.current).toEqual([91, 0]);
    rerender({ count: 10, filter: true });
    expect(result.current).toEqual([91, 0]);
    rerender({ count: 1, filter: true });
    expect(result.current).toEqual([92, 0]);
    act(() => useLapTimesStore.getState().reset());
    expect(result.current).toEqual([]);
  });

  it('supports windows larger than ten and sanitizes persisted lap counts', () => {
    useLapTimesStore.getState().applySnapshot({
      lapTimes: [],
      lapTimeHistory: [Array.from({ length: 100 }, (_, i) => i + 1)],
      sessionNum: 2,
      version: 1,
    });
    const { result, rerender } = renderHook(
      ({ count }) => useCarIdxRollingAvgLapTime(count),
      { initialProps: { count: 20 } }
    );
    expect(result.current).toEqual([90.5]);
    for (const count of [0, -5, 1.9]) {
      rerender({ count });
      expect(result.current).toEqual([100]);
    }
    rerender({ count: Infinity });
    expect(result.current).toEqual([98]);
    rerender({ count: 500 });
    expect(result.current).toEqual([50.5]);
  });
});
