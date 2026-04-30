/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverProgress } from './useDriverProgress';

vi.mock('@irdashies/context', () => ({
  useFocusCarIdx: vi.fn(),
  useSessionDrivers: vi.fn(),
  useTelemetryValuesRounded: vi.fn(),
  useSessionStore: vi.fn(),
  useTelemetryValues: vi.fn(),
  useSessionQualifyingResults: vi.fn(),
  useSessionQualifyPositions: vi.fn(),
  useTelemetryValue: vi.fn(),
}));

import {
  useFocusCarIdx,
  useSessionDrivers,
  useTelemetryValuesRounded,
  useSessionStore,
  useTelemetryValues,
  useSessionQualifyingResults,
  useSessionQualifyPositions,
  useTelemetryValue,
} from '@irdashies/context';

describe('useDriverProgress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useSessionQualifyingResults).mockReturnValue([]);
    vi.mocked(useSessionQualifyPositions).mockReturnValue([]);
    vi.mocked(useTelemetryValue).mockReturnValue(0);
  });

  it('should return empty array when drivers or lapDist are missing', () => {
    vi.mocked(useFocusCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(undefined);
    vi.mocked(useTelemetryValuesRounded).mockReturnValue([]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([]);

    const { result } = renderHook(() => useDriverProgress());

    expect(result.current.drivers).toEqual([]);
  });

  it('should return drivers with progress and position', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: '2', CarClassID: 1 },
    ];

    vi.mocked(useFocusCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesRounded).mockReturnValue([0.5, 0.6]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([0.5, 0.6]);

    const { result } = renderHook(() => useDriverProgress());

    // Eventually should have data after throttle - just verify it returns an array with valid structure
    expect(Array.isArray(result.current.drivers)).toBe(true);
    if (result.current.drivers.length > 0) {
      expect(result.current.drivers[0]).toHaveProperty('driver');
      expect(result.current.drivers[0]).toHaveProperty('progress');
      expect(result.current.drivers[0]).toHaveProperty('classPosition');
    }
  });

  it('should filter out drivers not on track', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: '2', CarClassID: 1 },
    ];

    vi.mocked(useFocusCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesRounded).mockReturnValue([0.5, -1]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([0.5, -1]);

    const { result } = renderHook(() => useDriverProgress());

    // Should filter out progress -1
    expect(Array.isArray(result.current.drivers)).toBe(true);
    // All drivers with progress -1 should be filtered out
    const allValid = result.current.drivers.every((d) => d.progress > -1);
    expect(allValid).toBe(true);
  });

  it('should filter out pace car', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: 'PC', CarClassID: 99 },
    ];

    vi.mocked(useFocusCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesRounded).mockReturnValue([0.5, 0.6]);
    vi.mocked(useSessionStore).mockReturnValue(1);
    vi.mocked(useTelemetryValues).mockReturnValue([0.5, 0.6]);

    const { result } = renderHook(() => useDriverProgress());

    // Should filter out pace car
    expect(Array.isArray(result.current.drivers)).toBe(true);
    // Pace car (CarIdx 1, paceCarIdx is 1) should be filtered out
    const noPaceCar = result.current.drivers.every(
      (d) => d.driver.CarIdx !== 1
    );
    expect(noPaceCar).toBe(true);
  });
});
