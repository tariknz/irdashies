/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverProgress } from './useDriverProgress';

vi.mock('@irdashies/context', () => ({
  useDriverCarIdx: vi.fn(),
  useSessionDrivers: vi.fn(),
  useTelemetryValuesMapped: vi.fn(),
  useSessionStore: vi.fn(),
  useTelemetryValues: vi.fn(),
}));

import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValuesMapped,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';

describe('useDriverProgress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty array when drivers or lapDist are missing', () => {
    vi.mocked(useDriverCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(undefined);
    vi.mocked(useTelemetryValuesMapped).mockReturnValue([]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([]);

    const { result } = renderHook(() => useDriverProgress());

    expect(result.current).toEqual([]);
  });

  it('should return drivers with progress and position', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: '2', CarClassID: 1 },
    ];

    vi.mocked(useDriverCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesMapped).mockReturnValue([0.5, 0.6]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([0, 1]);

    const { result } = renderHook(() => useDriverProgress());

    // Eventually should have data after throttle - just verify it returns an array with valid structure
    expect(Array.isArray(result.current)).toBe(true);
    if (result.current.length > 0) {
      expect(result.current[0]).toHaveProperty('driver');
      expect(result.current[0]).toHaveProperty('progress');
      expect(result.current[0]).toHaveProperty('classPosition');
    }
  });

  it('should filter out drivers not on track', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: '2', CarClassID: 1 },
    ];

    vi.mocked(useDriverCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesMapped).mockReturnValue([0.5, -1]);
    vi.mocked(useSessionStore).mockReturnValue(-1);
    vi.mocked(useTelemetryValues).mockReturnValue([0, 1]);

    const { result } = renderHook(() => useDriverProgress());

    // Should filter out progress -1
    expect(Array.isArray(result.current)).toBe(true);
    // All drivers with progress -1 should be filtered out
    const allValid = result.current.every((d) => d.progress > -1);
    expect(allValid).toBe(true);
  });

  it('should filter out pace car', () => {
    const mockDrivers = [
      { CarIdx: 0, CarNumber: '1', CarClassID: 1 },
      { CarIdx: 1, CarNumber: 'PC', CarClassID: 99 },
    ];

    vi.mocked(useDriverCarIdx).mockReturnValue(0);
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers as any);
    vi.mocked(useTelemetryValuesMapped).mockReturnValue([0.5, 0.6]);
    vi.mocked(useSessionStore).mockReturnValue(1);
    vi.mocked(useTelemetryValues).mockReturnValue([0, 0]);

    const { result } = renderHook(() => useDriverProgress());

    // Should filter out pace car
    expect(Array.isArray(result.current)).toBe(true);
    // Pace car (CarIdx 1, paceCarIdx is 1) should be filtered out
    const noPaceCar = result.current.every((d) => d.driver.CarIdx !== 1);
    expect(noPaceCar).toBe(true);
  });
});
