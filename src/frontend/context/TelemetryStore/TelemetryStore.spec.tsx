import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useTelemetryStore,
  useTelemetry,
  useTelemetryValue,
  useTelemetryValues,
  useTelemetryValuesThrottled,
} from './TelemetryStore';
import type { Telemetry } from '@irdashies/types';

const mockTelemetry: Telemetry = {
  Speed: { value: [100, 101, 102] },
  RPM: { value: [9000, 9100, 9200] },
  IsOnTrack: { value: [true, false, true] },
} as Telemetry;

const emptyTelemetry: Telemetry = {
  Speed: { value: [] as number[] },
  RPM: { value: [] as number[] },
  IsOnTrack: { value: [] as boolean[] },
} as Telemetry;

describe('TelemetryStore', () => {
  beforeEach(() => {
    useTelemetryStore.getState().setTelemetry(null);
  });

  describe('useTelemetryStore', () => {
    it('should set and get telemetry', () => {
      useTelemetryStore.getState().setTelemetry(mockTelemetry);
      expect(useTelemetryStore.getState().telemetry).toEqual(mockTelemetry);
    });
  });

  describe('useTelemetry', () => {
    it('should return the correct telemetry var', () => {
      useTelemetryStore.getState().setTelemetry(mockTelemetry);
      const { result } = renderHook(() => useTelemetry('Speed'));
      expect(result.current).toEqual({ value: [100, 101, 102] });
    });
    it('should return undefined if telemetry is null', () => {
      useTelemetryStore.getState().setTelemetry(null as unknown as Telemetry);
      const { result } = renderHook(() => useTelemetry('Speed'));
      expect(result.current).toBeUndefined();
    });
  });

  describe('useTelemetryValue', () => {
    it('should return the first value for a key', () => {
      useTelemetryStore.getState().setTelemetry(mockTelemetry);
      const { result } = renderHook(() => useTelemetryValue<number>('Speed'));
      expect(result.current).toBe(100);
    });
    it('should return undefined if value is empty', () => {
      useTelemetryStore.getState().setTelemetry(emptyTelemetry);
      const { result } = renderHook(() => useTelemetryValue<number>('Speed'));
      expect(result.current).toBeUndefined();
    });
  });

  describe('useTelemetryValues', () => {
    it('should return all values for a key', () => {
      useTelemetryStore.getState().setTelemetry(mockTelemetry);
      const { result } = renderHook(() => useTelemetryValues('RPM'));
      expect(result.current).toEqual([9000, 9100, 9200]);
    });
    it('should return empty array if value is empty', () => {
      useTelemetryStore.getState().setTelemetry(emptyTelemetry);
      const { result } = renderHook(() => useTelemetryValues('RPM'));
      expect(result.current).toEqual([]);
    });
  });

  describe('useTelemetryValuesThrottled', () => {
    // Regression test for the Standings perf fix: a full-grid array (e.g.
    // CarIdxLapDistPct) changes on nearly every 60Hz tick once enough cars
    // are on track, so value-based rounding alone never throttles
    // re-renders. This proves the time-based gate actually caps render
    // count regardless of how often the underlying value changes.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ignores changes between samples and picks up the latest value at the next tick', () => {
      useTelemetryStore
        .getState()
        .setTelemetry({ ...mockTelemetry, Speed: { value: [1, 2] } } as Telemetry);

      const { result } = renderHook(() =>
        useTelemetryValuesThrottled('Speed', 100)
      );
      expect(result.current).toEqual([1, 2]);

      // Several rapid changes within one sampling window.
      act(() => {
        useTelemetryStore
          .getState()
          .setTelemetry({ ...mockTelemetry, Speed: { value: [3, 4] } } as Telemetry);
        useTelemetryStore
          .getState()
          .setTelemetry({ ...mockTelemetry, Speed: { value: [5, 6] } } as Telemetry);
        useTelemetryStore
          .getState()
          .setTelemetry({ ...mockTelemetry, Speed: { value: [7, 8] } } as Telemetry);
      });
      // No re-render has happened yet — the sampler hasn't ticked.
      expect(result.current).toEqual([1, 2]);

      // Once the interval elapses, only the latest value is picked up.
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toEqual([7, 8]);
    });

    it('does not change reference when the sampled value is unchanged', () => {
      useTelemetryStore
        .getState()
        .setTelemetry({ ...mockTelemetry, Speed: { value: [1, 2] } } as Telemetry);

      const { result } = renderHook(() =>
        useTelemetryValuesThrottled('Speed', 100)
      );
      const firstValue = result.current;

      act(() => {
        // Same values, new array reference.
        useTelemetryStore
          .getState()
          .setTelemetry({ ...mockTelemetry, Speed: { value: [1, 2] } } as Telemetry);
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe(firstValue);
    });
  });
});
