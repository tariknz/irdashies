import { act, renderHook } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import { useTelemetryValues } from '@irdashies/context';
import { useRadioActiveCarIdxs } from './useRadioActiveCarIdxs';

vi.mock('@irdashies/context');

describe('useRadioActiveCarIdxs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('passes the live value straight through when persistence is disabled', () => {
    vi.mocked(useTelemetryValues).mockReturnValue([5] as number[]);
    const { result } = renderHook(() => useRadioActiveCarIdxs(0));
    expect(result.current).toEqual([5]);
  });

  it('filters out the -1 idle sentinel', () => {
    vi.mocked(useTelemetryValues).mockReturnValue([-1] as number[]);
    const { result } = renderHook(() => useRadioActiveCarIdxs(0));
    expect(result.current).toEqual([]);
  });

  it('keeps a car active for the persistence window after it stops transmitting', () => {
    const { result, rerender } = renderHook(
      ({ value }) => {
        vi.mocked(useTelemetryValues).mockReturnValue(value as number[]);
        return useRadioActiveCarIdxs(3000);
      },
      { initialProps: { value: [5] } }
    );

    // Effect runs and records the active car.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toEqual([5]);

    // Driver stops transmitting; icon should linger through the window.
    rerender({ value: [-1] });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual([5]);

    // After the full window elapses, the car clears even with no new telemetry.
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current).toEqual([]);
  });

  it('refreshes the window each time a car is seen transmitting again', () => {
    const { result, rerender } = renderHook(
      ({ value }) => {
        vi.mocked(useTelemetryValues).mockReturnValue(value as number[]);
        return useRadioActiveCarIdxs(3000);
      },
      { initialProps: { value: [5] } }
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Seen again before expiry — resets the countdown.
    rerender({ value: [5] });
    rerender({ value: [-1] });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toEqual([5]);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current).toEqual([]);
  });

  it('stays solidly lit while a car flip-flaps the radio rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value }) => {
        vi.mocked(useTelemetryValues).mockReturnValue(value as number[]);
        return useRadioActiveCarIdxs(3000);
      },
      { initialProps: { value: [5] } }
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Toggle on/off every 500ms for several cycles. The icon must never clear:
    // each "on" frame keeps pushing the 3s deadline out.
    for (let i = 0; i < 6; i++) {
      rerender({ value: [-1] });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current).toEqual([5]);

      rerender({ value: [5] });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current).toEqual([5]);
    }

    // Once they truly stop, it clears after the full window.
    rerender({ value: [-1] });
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current).toEqual([]);
  });
});
