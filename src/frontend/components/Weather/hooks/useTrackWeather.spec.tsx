import { useTelemetry, useTelemetryValue } from '@irdashies/context';
import { renderHook } from '@testing-library/react';
import { describe, beforeEach, vi, it, expect } from 'vitest';
import { useTrackWeather } from './useTrackWeather';

vi.mock('@irdashies/context');

describe('useTrackWeather', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return track weather data from telemetry values', () => {
    vi.mocked(useTelemetryValue).mockImplementation((key) => {
      const mockValues = {
        TrackWetness: 2,
        YawNorth: 45,
        WindDir: 270,
        WindVel: 8.3,
      };
      return mockValues[key as keyof typeof mockValues];
    });

    const { result } = renderHook(() => useTrackWeather());

    expect(result.current).toEqual({
      trackMoisture: 2,
      windDirection: 270,
      windVelocity: 8.3,
      windYaw: 45,
    });
  });

  it('should handle undefined telemetry values', () => {
    const mockFn = vi.fn();
    mockFn.mockReturnValue(undefined);
    vi.mocked(useTelemetry).mockImplementation(mockFn);

    const { result } = renderHook(() => useTrackWeather());

    expect(result.current).toEqual({
      trackMoisture: undefined,
      windDirection: undefined,
      windVelocity: undefined,
      windYaw: undefined,
    });
  });
});
