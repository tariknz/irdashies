import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentTime } from './useCurrentTime';

const formatHHMM = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

describe('useCurrentTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current wall-clock time on mount', () => {
    const mountAt = new Date(2026, 4, 8, 12, 0, 30, 500);
    vi.setSystemTime(mountAt);

    const { result } = renderHook(() => useCurrentTime());

    expect(result.current).toBe(formatHHMM(mountAt));
  });

  it('updates exactly at the next wall-clock minute boundary, not 60s after mount', () => {
    // mount 30.5s into the minute — naive setInterval(60s) would tick at 12:01:30.5
    // and only show "12:01" then, almost a full minute stale.
    const mountAt = new Date(2026, 4, 8, 12, 0, 30, 500);
    vi.setSystemTime(mountAt);

    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBe(formatHHMM(mountAt));

    // 1ms before the minute boundary — should still show 12:00.
    act(() => {
      vi.advanceTimersByTime(60_000 - 30_500 - 1);
    });
    expect(result.current).toBe(
      formatHHMM(new Date(2026, 4, 8, 12, 0, 59, 999))
    );

    // crossing the boundary — should flip to 12:01 immediately.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(formatHHMM(new Date(2026, 4, 8, 12, 1, 0, 0)));
  });

  it('continues to align to subsequent minute boundaries', () => {
    const mountAt = new Date(2026, 4, 8, 12, 0, 45, 0);
    vi.setSystemTime(mountAt);

    const { result } = renderHook(() => useCurrentTime());

    // 12:00 -> 12:01 at 15s elapsed
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current).toBe(formatHHMM(new Date(2026, 4, 8, 12, 1, 0, 0)));

    // 12:01 -> 12:02 at 60s after that
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(formatHHMM(new Date(2026, 4, 8, 12, 2, 0, 0)));

    // 12:02 -> 12:03 at another 60s
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(formatHHMM(new Date(2026, 4, 8, 12, 3, 0, 0)));
  });

  it('handles mount exactly on a minute boundary', () => {
    const mountAt = new Date(2026, 4, 8, 12, 0, 0, 0);
    vi.setSystemTime(mountAt);

    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBe(formatHHMM(mountAt));

    // 60_000 % 60_000 === 0, so the hook schedules the next tick 60s out.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(formatHHMM(new Date(2026, 4, 8, 12, 1, 0, 0)));
  });

  it('clears its timeout on unmount', () => {
    vi.setSystemTime(new Date(2026, 4, 8, 12, 0, 30, 0));
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = renderHook(() => useCurrentTime());
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    // After unmount, no further timers should fire — advancing time should not throw or update state.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5 * 60_000);
      });
    }).not.toThrow();
  });
});
