import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverRelatives } from './useDriverRelatives';
import { useDriverCarIdx, useSessionStore, useTelemetryValues, useTimingInterpolation } from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useDriverCarIdx: vi.fn(),
  useTelemetryValues: vi.fn(),
  useSessionStore: vi.fn(),
  useTimingInterpolation: vi.fn(),
}));

vi.mock('./useDriverPositions', () => ({
  useDriverStandings: vi.fn(),
}));

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
    // Mock timing interpolation to return null (fallback to original method)
    vi.mocked(useTimingInterpolation).mockReturnValue({
      bestLapByCarClass: new Map(),
      getTimeByDistance: vi.fn().mockReturnValue(null),
      getTimeDelta: vi.fn().mockReturnValue(null),
      clearTimingData: vi.fn(),
      isRecording: false,
      getStats: vi.fn().mockReturnValue({
        totalCarClasses: 0,
        bestLapTimes: {},
        dataPoints: {},
      }),
    });
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

  describe('Timing Interpolation Integration', () => {
    it('should use timing interpolation when available', () => {
      // Create a fresh mock function for this test
      // Calls happen in order: [player vs player], [player vs car1], [player vs car2]
      const mockGetTimeDelta = vi.fn()
        .mockReturnValueOnce(0)     // Player vs Player (carIdx 0)
        .mockReturnValueOnce(5.5)   // Player vs Car1 (carIdx 1) 
        .mockReturnValueOnce(-8.2); // Player vs Car2 (carIdx 2)

      const mockTimingInterpolation = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: mockGetTimeDelta,
        clearTimingData: vi.fn(),
        isRecording: true,
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 1,
          bestLapTimes: { 1: 100.5 },
          dataPoints: { 1: 50 },
        }),
      };

      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolation);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      // Should use interpolated values instead of calculated estimates
      expect(result.current).toHaveLength(3);
      
      // Find cars by their carIdx since ordering depends on relativePct
      const carAhead = result.current.find(car => car.carIdx === 1);
      const player = result.current.find(car => car.carIdx === 0); 
      const carBehind = result.current.find(car => car.carIdx === 2);
      
      expect(carAhead).toBeDefined();
      expect(player).toBeDefined();
      expect(carBehind).toBeDefined();
      
      // Car ahead should use interpolated delta
      expect(carAhead?.delta).toBe(5.5); // From interpolation, not (0.1 * 100)
      
      // Player car
      expect(player?.delta).toBe(0);
      
      // Car behind should use interpolated delta  
      expect(carBehind?.delta).toBe(-8.2); // From interpolation, not (-0.1 * 100)

      // Verify interpolation was called with correct parameters
      expect(mockGetTimeDelta).toHaveBeenCalledTimes(3);
      expect(mockGetTimeDelta).toHaveBeenCalledWith(
        0, 1, 0.5, 0.6, mockDrivers // playerCarIdx, otherCarIdx, playerDist, otherDist, drivers
      );
      expect(mockGetTimeDelta).toHaveBeenCalledWith(
        0, 0, 0.5, 0.5, mockDrivers
      );
      expect(mockGetTimeDelta).toHaveBeenCalledWith(
        0, 2, 0.5, 0.4, mockDrivers
      );
    });

    it('should fall back to estimation when interpolation returns null', () => {
      const mockTimingInterpolation = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: vi.fn(),
        clearTimingData: vi.fn(),
        isRecording: false,
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 0,
          bestLapTimes: {},
          dataPoints: {},
        }),
      };

      // Mock interpolation to return null (no timing data available)
      mockTimingInterpolation.getTimeDelta.mockReturnValue(null);

      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolation);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      // Should fall back to original estimation method
      expect(result.current).toHaveLength(3);
      
      // Should use fallback calculations (distance * lapTime)
      expect(result.current[0].delta).toBeCloseTo(10); // 0.1 * 100
      expect(result.current[2].delta).toBeCloseTo(-10); // -0.1 * 100
      
      // Verify interpolation was attempted first
      expect(mockTimingInterpolation.getTimeDelta).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed interpolation results (some null, some valid)', () => {
      // Create a fresh mock function for this test
      // Calls happen in order: [player vs player], [player vs car1], [player vs car2]
      const mockGetTimeDelta = vi.fn()
        .mockReturnValueOnce(0)     // Player vs Player 
        .mockReturnValueOnce(7.3)   // Player vs Car1 - has interpolation data
        .mockReturnValueOnce(null); // Player vs Car2 - no interpolation data

      const mockTimingInterpolation = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: mockGetTimeDelta,
        clearTimingData: vi.fn(),
        isRecording: true,
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 1,
          bestLapTimes: { 1: 95.2 },
          dataPoints: { 1: 25 },
        }),
      };

      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolation);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      expect(result.current).toHaveLength(3);
      
      // Find cars by their carIdx
      const carAhead = result.current.find(car => car.carIdx === 1);
      const player = result.current.find(car => car.carIdx === 0);
      const carBehind = result.current.find(car => car.carIdx === 2);
      
      // Car ahead should use interpolated value
      expect(carAhead?.delta).toBe(7.3);
      
      // Player car
      expect(player?.delta).toBe(0);
      
      // Car behind should use fallback calculation
      expect(carBehind?.delta).toBeCloseTo(-10); // -0.1 * 100 (fallback)
    });

    it('should use interpolation for lap crossing scenarios', () => {
      const mockTimingInterpolation = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: vi.fn(),
        clearTimingData: vi.fn(),
        isRecording: true,
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 1,
          bestLapTimes: { 1: 120.0 },
          dataPoints: { 1: 80 },
        }),
      };

      // Test lap crossing scenario where one car crossed start/finish
      const mockCarIdxLapDistPctCrossing = [0.1, 0.9, 0.2]; // Player at 10%, car ahead at 90%, car behind at 20%

      vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
        if (key === 'CarIdxLapDistPct') return mockCarIdxLapDistPctCrossing;
        if (key === 'CarIdxEstTime') return mockCarIdxEstTime;
        return [];
      });

      // Create a fresh mock function for this test
      // Calls happen in order: [player vs player], [player vs car1], [player vs car2]
      const mockGetTimeDelta = vi.fn()
        .mockReturnValueOnce(0)      // Player vs Player 
        .mockReturnValueOnce(-15.5)  // Player vs Car1 (complex lap crossing calculation)
        .mockReturnValueOnce(12.5);  // Player vs Car2

      mockTimingInterpolation.getTimeDelta = mockGetTimeDelta;
      
      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolation);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      expect(result.current).toHaveLength(3);
      
      // Find cars by their carIdx since ordering depends on relativePct  
      const car1 = result.current.find(car => car.carIdx === 1);
      const player = result.current.find(car => car.carIdx === 0);
      const car2 = result.current.find(car => car.carIdx === 2);
      
      // Should use interpolated deltas that properly handle lap crossing
      expect(car1?.delta).toBe(-15.5); // Interpolation handles the complexity
      expect(player?.delta).toBe(0);
      expect(car2?.delta).toBe(12.5);
    });

    it('should work with interpolation disabled when cars are off-track', () => {
      const mockTimingInterpolation = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: vi.fn(),
        clearTimingData: vi.fn(),
        isRecording: false,
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 0,
          bestLapTimes: {},
          dataPoints: {},
        }),
      };

      // Mock interpolation to return null (no timing data available)
      mockTimingInterpolation.getTimeDelta.mockReturnValue(null);

      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolation);

      // Mock driver standings with all cars but mark one as off-track
      const mockDriversWithOffTrackCar = [
        { ...mockDrivers[0] }, // Player car (carIdx 0)
        { ...mockDrivers[1], onTrack: false }, // Car 1 off-track
        { ...mockDrivers[2] }, // Car 2 (carIdx 2)
      ];
      vi.mocked(useDriverStandings).mockReturnValue(mockDriversWithOffTrackCar);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      // Should filter out off-track car, leaving only player and car2
      expect(result.current).toHaveLength(2); // Only player and car2
      expect(result.current.some((driver) => driver.carIdx === 1)).toBe(false);
    });

    it('should not record timing data during pace laps to prevent corrupted interpolation', () => {
      // Mock SessionState.ParadeLaps (pace lap phase)
      const mockTimingInterpolationPaceLap = {
        bestLapByCarClass: new Map(),
        getTimeByDistance: vi.fn().mockReturnValue(null),
        getTimeDelta: vi.fn().mockReturnValue(null),
        clearTimingData: vi.fn(),
        isRecording: false, // Should not be recording during pace laps
        getStats: vi.fn().mockReturnValue({
          totalCarClasses: 0,
          bestLapTimes: {},
          dataPoints: {},
        }),
      };

      vi.mocked(useTimingInterpolation).mockReturnValue(mockTimingInterpolationPaceLap);

      const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));

      // Should fall back to original estimation since no interpolation data is available
      expect(result.current).toHaveLength(3);
      
      const carAhead = result.current.find(car => car.carIdx === 1);
      const player = result.current.find(car => car.carIdx === 0);
      const carBehind = result.current.find(car => car.carIdx === 2);
      
      // Should use fallback calculations (distance * lapTime) during pace laps
      expect(carAhead?.delta).toBeCloseTo(10); // 0.1 * 100 (fallback)
      expect(player?.delta).toBe(0);
      expect(carBehind?.delta).toBeCloseTo(-10); // -0.1 * 100 (fallback)
      
      // Verify interpolation was not recording (isRecording: false)
      expect(mockTimingInterpolationPaceLap.isRecording).toBe(false);
    });
  });
});
