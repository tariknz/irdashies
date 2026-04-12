import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCarIdxSpeed } from './useCarIdxSpeed';
import { useTelemetryStore } from '@irdashies/context';
import {
  useCarSpeedsStore,
  useCarSpeeds,
} from '../CarSpeedStore/CarSpeedsStore';
import { useTrackLength } from '@irdashies/context';
import type { Telemetry } from '@irdashies/types';

// Mock the stores
vi.mock('../TelemetryStore/TelemetryStore', () => ({
  useTelemetryStore: vi.fn(),
}));

vi.mock('../CarSpeedStore/CarSpeedsStore', () => ({
  useCarSpeedsStore: vi.fn(),
  useCarSpeeds: vi.fn(),
}));

vi.mock('../SessionStore/SessionStore', () => ({
  useTrackLength: vi.fn(),
}));

function makeTelemetry(speeds: number[]): Telemetry {
  return {
    CarIdxSpeed: { value: speeds },
  } as unknown as Telemetry;
}

const mockCarSpeedsState = {
  carSpeedBuffer: null,
  lastSpeedUpdate: 0,
  carSpeeds: [],
  updateCarSpeeds: vi.fn(),
  resetCarSpeeds: vi.fn(),
};

describe('useCarIdxSpeed', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should return empty array when no telemetry data', () => {
    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry: null });
    vi.mocked(useCarSpeedsStore).mockImplementation((selector) =>
      selector(mockCarSpeedsState)
    );
    vi.mocked(useCarSpeeds).mockReturnValue([]);

    const { result } = renderHook(() => useCarIdxSpeed());
    expect(result.current).toEqual([]);
  });

  it('should return empty array when no track length', () => {
    const telemetry = makeTelemetry([100, 120]);

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry });
    vi.mocked(useCarSpeedsStore).mockImplementation((selector) =>
      selector(mockCarSpeedsState)
    );
    vi.mocked(useCarSpeeds).mockReturnValue([]);

    const { result } = renderHook(() => useCarIdxSpeed());
    expect(result.current).toEqual([]);
  });

  it('should update car speeds when telemetry and track length are available', () => {
    const telemetry = makeTelemetry([100, 120]);
    const updateCarSpeeds = vi.fn();

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue(telemetry);
    vi.mocked(useTrackLength).mockReturnValue(5000);
    vi.mocked(useCarSpeedsStore).mockImplementation((selector) =>
      selector({ ...mockCarSpeedsState, updateCarSpeeds })
    );
    vi.mocked(useCarSpeeds).mockReturnValue([100, 120]);

    renderHook(() => useCarIdxSpeed());
    expect(updateCarSpeeds).toHaveBeenCalledWith(telemetry, 5000);
  });

  it('should return cached car speeds after initial update', () => {
    const telemetry = makeTelemetry([100, 120]);
    const updateCarSpeeds = vi.fn();

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry });
    vi.mocked(useTrackLength).mockReturnValue(5000);
    vi.mocked(useCarSpeedsStore).mockImplementation((selector) =>
      selector({ ...mockCarSpeedsState, updateCarSpeeds })
    );
    vi.mocked(useCarSpeeds).mockReturnValue([100, 120]);

    const { result } = renderHook(() => useCarIdxSpeed());
    expect(result.current).toEqual([100, 120]);
    expect(updateCarSpeeds).toHaveBeenCalledTimes(1);
  });
});
