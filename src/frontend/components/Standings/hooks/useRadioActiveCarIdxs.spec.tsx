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
    expect(result.current.active).toEqual([5]);
    expect(result.current.transmitting).toEqual([5]);
  });

  it('filters out the -1 idle sentinel from transmitting', () => {
    vi.mocked(useTelemetryValues).mockReturnValue([-1] as number[]);
    const { result } = renderHook(() => useRadioActiveCarIdxs(0));
    expect(result.current.transmitting).toEqual([]);
  });

  it('keeps a car active for the persistence window after it stops transmitting', () => {
    vi.mocked(useTelemetryValues).mockReturnValue([5] as number[]);
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
    expect(result.current.active).toEqual([5]);
    expect(result.current.transmitting).toEqual([5]);

    // Driver stops transmitting; icon should linger but no longer "transmit".
    rerender({ value: [-1] });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.active).toEqual([5]);
    expect(result.current.transmitting).toEqual([]);

    // After the full window elapses, the car clears even with no new telemetry.
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.active).toEqual([]);
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
    expect(result.current.active).toEqual([5]);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.active).toEqual([]);
  });
});
