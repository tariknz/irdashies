import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindDemoData } from './useWindDemoData';
import { WIND_DEMO_INTERVAL_MS } from './wind';

describe('useWindDemoData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when demo mode is off', () => {
    const { result } = renderHook(() => useWindDemoData(false, true));
    expect(result.current).toBeNull();
  });

  it('returns a cycling sample while demo mode is on', () => {
    const { result } = renderHook(() => useWindDemoData(true, true));

    expect(result.current?.speedMs).toBeCloseTo(2 / 3.6);
    expect(result.current?.direction).toBeCloseTo(0);

    act(() => {
      vi.advanceTimersByTime(WIND_DEMO_INTERVAL_MS);
    });
    expect(result.current?.speedMs).toBeCloseTo(8 / 3.6);

    act(() => {
      vi.advanceTimersByTime(WIND_DEMO_INTERVAL_MS * 3);
    });
    expect(result.current?.speedMs).toBeCloseTo(44 / 3.6);
  });

  it('uses imperial conversion when metric is false', () => {
    const { result } = renderHook(() => useWindDemoData(true, false));
    expect(result.current?.speedMs).toBeCloseTo(2 / 2.23694);
  });
});
