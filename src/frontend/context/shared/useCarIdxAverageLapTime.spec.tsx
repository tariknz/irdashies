import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';
import { useTelemetryValues } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore, useLapTimes } from '../LapTimesStore/LapTimesStore';
import { useCarIdxClassEstLapTime } from '../SessionStore/SessionStore';

// Mock the stores
vi.mock('../TelemetryStore/TelemetryStore', () => ({
  useTelemetryValues: vi.fn(),
}));

vi.mock('../LapTimesStore/LapTimesStore', () => ({
  useLapTimesStore: vi.fn(),
  useLapTimes: vi.fn(),
}));

vi.mock('../SessionStore/SessionStore', () => ({
  useCarIdxClassEstLapTime: vi.fn(),
}));

const mockLapTimesState = {
  lapTimeBuffer: null,
  lapTimes: [],
  updateLapTimes: vi.fn(),
  reset: vi.fn(),
};

describe('useCarIdxAverageLapTime', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should return empty array when no session data', () => {
    vi.mocked(useTelemetryValues).mockReturnValue([]);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([]);
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue({});

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([]);
  });

  it('should use class lap time as fallback when no lap time available', () => {
    const mockDrivers = {
      0: 90.5, 
      1: 91.2,
    };

    vi.mocked(useTelemetryValues).mockReturnValue([]);
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

    vi.mocked(useTelemetryValues).mockReturnValue([89.8, 90.1]);
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
    const carIdxLastLapTime = [89.8, 90.1];

    vi.mocked(useTelemetryValues).mockReturnValue(carIdxLastLapTime);
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue({});
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector({ ...mockLapTimesState, updateLapTimes })
    );
    vi.mocked(useLapTimes).mockReturnValue([89.8, 90.1]);

    renderHook(() => useCarIdxAverageLapTime());
    expect(updateLapTimes).toHaveBeenCalledWith(carIdxLastLapTime);
  });

  it('should handle mixed known and unknown lap times', () => {
    const mockDrivers = {0: 90.5, 1: 91.2};

    vi.mocked(useTelemetryValues).mockReturnValue([]);
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

    vi.mocked(useTelemetryValues).mockReturnValue([]);
    vi.mocked(useCarIdxClassEstLapTime).mockReturnValue(mockDrivers);
    vi.mocked(useLapTimesStore).mockImplementation((selector) => 
      selector(mockLapTimesState)
    );
    vi.mocked(useLapTimes).mockReturnValue([0, 0]);

    const { result } = renderHook(() => useCarIdxAverageLapTime());
    expect(result.current).toEqual([-1, 91.2]);
  });
}); 