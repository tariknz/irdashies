import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore, useLapTimes } from '../LapTimesStore/LapTimesStore';
import { useCarIdxClassEstLapTime } from '../SessionStore/SessionStore';
import type { Telemetry } from '@irdashies/types';

// Mock the stores
vi.mock('../TelemetryStore/TelemetryStore', () => ({
  useTelemetryStore: vi.fn(),
}));

vi.mock('../LapTimesStore/LapTimesStore', () => ({
  useLapTimesStore: vi.fn(),
  useLapTimes: vi.fn(),
}));

vi.mock('../SessionStore/SessionStore', () => ({
  useCarIdxClassEstLapTime: vi.fn(),
}));

function makeTelemetry(lapTimes: number[], sessionTime: number): Telemetry {
  return {
    CarIdxLastLapTime: { value: lapTimes },
    SessionTime: { value: [sessionTime] },
  } as unknown as Telemetry;
}

const mockLapTimesState = {
  lapTimeBuffer: null,
  lastLapTimeUpdate: 0,
  lapTimes: [],
  updateLapTimes: vi.fn(),
  lastSessionNum: null,
};

describe('useCarIdxAverageLapTime', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should return empty array when no session data', () => {
    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry: null });
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([]);
  });

  it('should use class lap time as fallback when no lap time available', () => {
    const mockDrivers = [
      90.5, 
      91.2,
    ];

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry: null });
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue(mockDrivers);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([0, 0]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([90.5, 91.2]);
  });

  it('should use actual lap times when available', () => {
    const mockDrivers = {0: 90.5, 1: 91.2};

    const telemetry = makeTelemetry([89.8, 90.1], 1);

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry });
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue(mockDrivers);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([89.8, 90.1]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([89.8, 90.1]);
  });

  it('should update lap times when telemetry changes', () => {
    const updateLapTimes = vi.fn();
    const telemetry = makeTelemetry([89.8, 90.1], 1);

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue(telemetry);
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue([]);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector({ ...mockLapTimesState, updateLapTimes })
    );
    vi.mocked(useLapTimes).mockReturnValue([89.8, 90.1]);

    renderHook(() => useCarIdxAverageLapTime());
    expect(updateLapTimes).toHaveBeenCalledWith(telemetry);
  });

  it('should handle mixed known and unknown lap times', () => {
    const mockDrivers = {0: 90.5, 1: 91.2};

    // Mock store values with one known and one unknown lap time
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry: null });
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue(mockDrivers);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([89.8, 0]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([89.8, 91.2]);
  });

  it('should handle missing car indices in session data', () => {
    const mockDrivers = {1: 91.2};

    // Mock store values
    vi.mocked(useTelemetryStore).mockReturnValue({ telemetry: null });
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue(mockDrivers);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([0, 0]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([-1, 91.2]);
  });
}); 