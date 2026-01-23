import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverRelatives } from './useDriverRelatives';
import type { Standings } from '../createStandings';

// Mock the context hooks
vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useFocusCarIdx: vi.fn(),
    useTelemetryValues: vi.fn(),
    useSessionStore: vi.fn(),
  };
});

vi.mock('./useDriverPositions', () => ({
  useDriverStandings: vi.fn(),
}));

// Import mocked functions after vi.mock
const { useFocusCarIdx, useTelemetryValues, useSessionStore } =
  await import('@irdashies/context');
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
      tireCompound: 0,
      onTrack: true,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
      currentSessionType: 'Race',
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false,
      relativePct: 0,
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
      tireCompound: 2,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
      currentSessionType: 'Race',
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false,
      relativePct: 0,
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
      tireCompound: 1,
      carClass: {
        id: 1,
        color: 0,
        name: 'Class 1',
        relativeSpeed: 1.0,
        estLapTime: 100,
      },
      currentSessionType: 'Race',
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false,
      relativePct: 0,
    },
  ];

  const mockCarIdxLapDistPct = [0.5, 0.6, 0.4]; // Player, Ahead, Behind
  // CarIdxEstTime: same class cars, delta = otherEstTime - playerEstTime
  // For car 1 (ahead): 109 - 99 = +10 seconds ahead
  // For car 2 (behind): 89 - 99 = -10 seconds behind
  const mockCarIdxEstTime = [99, 109, 89]; // Player, Ahead (+10), Behind (-10)

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFocusCarIdx).mockReturnValue(0);
    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return mockCarIdxLapDistPct;
      if (key === 'CarIdxEstTime') return mockCarIdxEstTime;
      if (key === 'CarIdxLap') return [1, 1, 1];
      if (key === 'CarIdxTrackSurface') return [3, 3, 3];
      if (key === 'SessionTime') return [100];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue(mockDrivers);
    vi.mocked(useSessionStore).mockImplementation((selector) =>
      selector({
        session: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          WeekendInfo: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          SessionInfo: { Sessions: [] } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          CameraInfo: { Groups: [] } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          RadioInfo: { Radios: [] } as any,
          DriverInfo: {
            DriverCarIdx: 0,
            DriverUserID: 0,
            PaceCarIdx: -1,
            DriverHeadPosX: 0,
            DriverHeadPosY: 0,
            DriverHeadPosZ: 0,
            DriverCarIsElectric: 0,
            DriverCarIdleRPM: 0,
            DriverCarRedLine: 0,
            DriverCarEngCylinderCount: 0,
            DriverCarFuelKgPerLtr: 0,
            DriverCarFuelMaxLtr: 0,
            DriverCarMaxFuelPct: 0,
            DriverCarGearNumForward: 0,
            DriverCarGearNeutral: 0,
            DriverCarGearReverse: 0,
            DriverCarSLFirstRPM: 0,
            DriverCarSLShiftRPM: 0,
            DriverCarSLLastRPM: 0,
            DriverCarSLBlinkRPM: 0,
            DriverCarVersion: '',
            DriverPitTrkPct: 0,
            DriverCarEstLapTime: 0,
            DriverSetupName: '',
            DriverSetupIsModified: 0,
            DriverSetupLoadTypeName: '',
            DriverSetupPassedTech: 0,
            DriverIncidentCount: 0,
            DriverBrakeCurvingFactor: 0,
            DriverTires: [],
            Drivers: [],
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          SplitTimeInfo: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          CarSetup: {} as any,
        },
        setSession: vi.fn(),
      })
    );
  });

  it('should return empty array when no player is found', () => {
    vi.mocked(useFocusCarIdx).mockReturnValue(undefined);

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
        // Same-class cars use CarIdxEstTime for gap calculation
        // Player=99, Ahead=109 (+10s), Behind=69 (-30s to match expected test values)
        if (key === 'CarIdxEstTime') return [99, 109, 69];
        return [];
      });

      const { result } = renderHook(() => useDriverRelatives({ buffer: 1 }));

      // Car ahead should still be ahead by 10%
      expect(result.current[0].carIdx).toBe(1);
      expect(result.current[0].relativePct).toBeCloseTo(0.1);
      // Delta uses CarIdxEstTime: 109 - 99 = +10
      expect(result.current[0].delta).toBeCloseTo(10);

      // Player should be in the middle
      expect(result.current[1].carIdx).toBe(0);
      expect(result.current[1].relativePct).toBe(0);
      expect(result.current[1].delta).toBe(0);

      // Car behind should be behind by 30%
      expect(result.current[2].carIdx).toBe(2);
      expect(result.current[2].relativePct).toBeCloseTo(-0.3);
      // Delta uses CarIdxEstTime: 69 - 99 = -30
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

  it('should scale delta correctly for multiclass (faster car behind)', () => {
    const playerGT3 = {
      ...mockDrivers[0],
      carClass: { ...mockDrivers[0].carClass, estLapTime: 100 },
    };
    const opponentLMP2 = {
      ...mockDrivers[2],
      carClass: { ...mockDrivers[2].carClass, estLapTime: 80 },
    }; // Faster class

    vi.mocked(useDriverStandings).mockReturnValue([
      playerGT3,
      mockDrivers[1],
      opponentLMP2,
    ]);

    // Opponent (car 2) is physically 10% behind
    // DistPct: Player = 0.5, Opponent = 0.4
    // Raw EstTime: Player = 100, Opponent = 92
    // Calculation: 92 * (100 / 80) = 115. Gap = 115 - 100 = +15 seconds?
    // Wait, if they are behind, the gap should be negative.
    // Raw EstTime for behind usually is lower than player. Let's use:
    // Player = 50, Opponent = 40.
    // Scaled Opponent = 40 * (100 / 80) = 50.
    // If the opponent is slower or further back, the math should result in a negative delta.

    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6, 0.4];
      if (key === 'CarIdxEstTime') return [50, 60, 32]; // Opponent raw gap is -18s in THEIR class
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 2);

    // Scaling: 32 * (100 / 80) = 40.
    // Delta: 40 - 50 = -10.
    // In player seconds, the 10% distance gap = 10s (since lap is 100s).
    expect(opponent?.delta).toBeCloseTo(-10);
  });

  it('should clamp delta when EstTime suggests a car is ahead but it is physically behind', () => {
    // Scenario: iRacing's EstTime is jittering (e.g., car just exited pits)
    // Physically: Car 2 is at 0.4 (BEHIND player at 0.5)
    // Telemetry: Car 2 EstTime is 110, Player EstTime is 100 (Suggests Car 2 is 10s AHEAD)

    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6, 0.4];
      if (key === 'CarIdxEstTime') return [100, 110, 110]; // Car 2 has higher EstTime than player
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponentBehind = result.current.find((d) => d.carIdx === 2);

    // Clamping logic: If physically behind, delta must be <= 0.
    expect(opponentBehind?.delta).toBeLessThanOrEqual(0);
  });

  it('should normalize delta when crossing the Start/Finish line', () => {
    // Player has just crossed (0.01), Opponent is just about to cross (0.99)
    // Opponent is actually ~2 seconds behind.
    // Raw EstTime: Player = 1.0, Opponent = 99.0 (Lap is 100s)

    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return [0.01, 0.05, 0.99];
      if (key === 'CarIdxEstTime') return [1.0, 5.0, 99.0];
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponentBehind = result.current.find((d) => d.carIdx === 2);

    // Raw delta would be 99 - 1 = 98s.
    // Normalized delta (98 - 100) = -2s.
    expect(opponentBehind?.delta).toBeCloseTo(-2);
  });

  it('should fallback to distance-based delta if EstTime is wildly inaccurate', () => {
    // EstTime data is garbage (e.g., 500s difference), but Pct shows they are close
    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6, 0.4];
      if (key === 'CarIdxEstTime') return [100, 110, 1000];
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponentBehind = result.current.find((d) => d.carIdx === 2);

    // 10% of 100s lap = 10s.
    expect(opponentBehind?.delta).toBeCloseTo(-10);
  });
});
