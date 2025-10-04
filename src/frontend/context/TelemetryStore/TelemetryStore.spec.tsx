import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTelemetryStore,
  useTelemetry,
  useTelemetryValue,
  useTelemetryValues,
  useTelemetryValuesMapped,
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

  describe('useTelemetryValuesMapped', () => {
    it('should map all values for a key', () => {
      useTelemetryStore.getState().setTelemetry(mockTelemetry);
      const { result } = renderHook(() =>
        useTelemetryValuesMapped<number[]>(
          'RPM',
          (v: number) => v / 1000
        )
      );
      expect(result.current).toEqual([9, 9.1, 9.2]);
    });
    it('should return empty array if value is empty', () => {
      useTelemetryStore.getState().setTelemetry(emptyTelemetry);
      const { result } = renderHook(() =>
        useTelemetryValuesMapped<number[]>(
          'RPM',
          (v: number) => v / 1000
        )
      );
      expect(result.current).toEqual([]);
    });
  });
}); 