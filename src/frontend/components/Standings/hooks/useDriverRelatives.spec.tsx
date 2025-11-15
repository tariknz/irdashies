import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverRelatives } from './useDriverRelatives';
import type { Standings } from '../createStandings';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useDriverCarIdx: vi.fn(),
  useTelemetryValues: vi.fn(),
  useSessionStore: vi.fn(),
  useRelativeGapStore: vi.fn(),
}));

vi.mock('./useDriverPositions', () => ({
  useDriverStandings: vi.fn(),
}));

vi.mock('@irdashies/context/RelativeGapStore', () => ({
  detectEdgeCases: vi.fn(() => ({ isLapping: false, isBeingLapped: false, isMultiClass: false })),
  calculateRelativeGap: vi.fn(() => null),
}));

// Import mocked functions after vi.mock
const { useDriverCarIdx, useTelemetryValues, useSessionStore, useRelativeGapStore } = await import('@irdashies/context');
const { useDriverStandings } = await import('./useDriverPositions');

describe('useDriverRelatives', () => {
  const mockDrivers: Standings[] = [
    {
      carIdx: 0,
      classPosition: 1,
      isPlayer: true,
      driver: {
        name: 'Driver 1',
        carNum: '1',
        license: 'A',
        rating: 2000,
      },
      fastestTime: 100,
      hasFastestTime: true,
      lastTime: 105,
      onPitRoad: false,
      onTrack: true,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
    },
    {
      carIdx: 1,
      classPosition: 2,
      isPlayer: false,
      driver: {
        name: 'Driver 2',
        carNum: '2',
        license: 'B',
        rating: 1800,
      },
      fastestTime: 102,
      hasFastestTime: false,
      lastTime: 107,
      onPitRoad: false,
      onTrack: true,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
    },
    {
      carIdx: 2,
      classPosition: 3,
      isPlayer: false,
      driver: {
        name: 'Driver 3',
        carNum: '3',
        license: 'C',
        rating: 1600,
      },
      fastestTime: 104,
      hasFastestTime: false,
      lastTime: 109,
      onPitRoad: false,
      onTrack: true,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
    },
  ];

  const mockCarIdxLapDistPct = [0.5, 0.6, 0.4]; // Player, Ahead, Behind
  const mockCarIdxEstTime = [99, 100, 90]; // Player, Same class, Faster class

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDriverCarIdx).mockReturnValue(0);
    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return mockCarIdxLapDistPct;
      if (key === 'CarIdxEstTime') return mockCarIdxEstTime;
      if (key === 'CarIdxLap') return [1, 1, 1];
      if (key === 'CarIdxTrackSurface') return [3, 3, 3];
      if (key === 'SessionTime') return [100];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue(mockDrivers);
    vi.mocked(useSessionStore).mockReturnValue({
      session: {
        DriverInfo: {
          PaceCarIdx: 0,
        },
      },
    });
    vi.mocked(useRelativeGapStore).mockImplementation((selector: any) => {
      const mockState = {
        config: {
          enabled: false,
          interpolationMethod: 'linear' as const,
        },
        getCarHistory: vi.fn(() => ({ lapRecords: [] })),
      };
      return selector ? selector(mockState) : mockState;
    });
    // Mock getState for store access
    (useRelativeGapStore as any).getState = vi.fn(() => ({
      config: {
        enabled: false,
        interpolationMethod: 'linear' as const,
      },
      getCarHistory: vi.fn(() => ({ lapRecords: [] })),
    }));
  });

  it('should return empty array when no player is found', () => {
    vi.mocked(useDriverCarIdx).mockReturnValue(undefined);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    expect(result.current).toEqual([]);
  });

  it('should calculate correct deltas for cars ahead and behind', () => {
    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

    expect(result.current).toHaveLength(3); // Player + 1 ahead + 1 behind
    expect(result.current[0].carIdx).toBe(1); // Car ahead
    expect(result.current[1].carIdx).toBe(0); // Player
    expect(result.current[2].carIdx).toBe(2); // Car behind

    // Car ahead should have positive delta
    expect(result.current[0].delta).toBeGreaterThan(0);
    // Player should have zero delta
    expect(result.current[1].delta).toBe(0);
    // Car behind should have negative delta
    expect(result.current[2].delta).toBeLessThan(0);
  });

  it('should respect buffer limit', () => {
    const { result } = renderHook(() => useDriverRelatives({ buffer: 1 }));

    // Should only include player and one car ahead/behind
    expect(result.current).toHaveLength(3);
  });

  it.each([
    [0.1, 0.2, 0.8], // Player near start, Car ahead near start, Car behind near finish
    [0.2, 0.3, 0.9],
    [0, 0.1, 0.7],
    [0.9, 0, 0.6],
  ])(
    'should handle cars crossing the start/finish line',
    (playerDistPct, aheadDistPct, behindDistPct) => {
      const mockCarIdxLapDistPctWithCrossing = [
        playerDistPct,
        aheadDistPct,
        behindDistPct,
      ];

      vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
        if (key === 'CarIdxLapDistPct') return mockCarIdxLapDistPctWithCrossing;
        if (key === 'CarIdxEstTime') return mockCarIdxEstTime;
        return [];
      });

      const { result } = renderHook(() => useDriverRelatives({ buffer: 1 }));

      // Car ahead should still be ahead by 10%
      expect(result.current[0].carIdx).toBe(1);
      expect(result.current[0].relativePct).toBeCloseTo(0.1);
      expect(result.current[0].delta).toBeCloseTo(10);

      // Player should be in the middle
      expect(result.current[1].carIdx).toBe(0);
      expect(result.current[1].relativePct).toBe(0);
      expect(result.current[1].delta).toBe(0);

      // Car behind should be behind by 20%
      expect(result.current[2].carIdx).toBe(2);
      expect(result.current[2].relativePct).toBeCloseTo(-0.3);
      expect(result.current[2].delta).toBeCloseTo(-30);
    }
  );

  it('should filter out off-track cars', () => {
    const mockDriversWithOffTrack = [
      { ...mockDrivers[0] },
      { ...mockDrivers[1], onTrack: false },
      { ...mockDrivers[2] },
    ];

    vi.mocked(useDriverStandings).mockReturnValue(mockDriversWithOffTrack);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

    // Should not include the off-track car
    expect(result.current).toHaveLength(2);
    expect(result.current.some((driver) => driver.carIdx === 1)).toBe(false);
  });
});
