import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverRelatives } from './useDriverRelatives';
import type { Standings } from '../createStandings';
import {
  ReferenceLap,
  ReferencePoint,
  useReferenceRegistry,
} from './useReferenceRegistry';

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

// 2. Replicate the simple normalize logic
// (We cannot import the real one because of hoisting)

vi.mock('./useReferenceRegistry', () => {
  // 1. Define the constant LOCALLY so it is available instantly
  const INTERVAL = 0.0025;
  const normalizeKey = (key: number) => {
    // Logic: Floor to nearest interval and fix float precision
    const val = key - (key % INTERVAL);
    return parseFloat(val.toFixed(4));
  };
  return {
    useReferenceRegistry: vi.fn(),
    // We MUST pass through the real normalizeKey, otherwise our Map keys
    // in the test helper and the component will all be undefined.
    normalizeKey: normalizeKey,
    REFERENCE_INTERVAL: INTERVAL,
  };
});

// =============================================================================
// HELPER: Generate a full Reference Lap with 400 points (0.25% interval)
// =============================================================================
const generateReferenceLap = (lapTime: number): ReferenceLap => {
  const INTERVAL = 0.0025;
  const normalizeKey = (key: number) => {
    // Logic: Floor to nearest interval and fix float precision
    const val = key - (key % INTERVAL);
    return parseFloat(val.toFixed(4));
  };
  const refPoints = new Map<number, ReferencePoint>();
  // Generate points every 0.0025 (0.25%) -> 400 points total
  for (let i = 0; i <= 400; i++) {
    const pct = i * 0.0025;
    // Ensure precision matches your normalizeKey logic
    const key = normalizeKey(pct);
    refPoints.set(key, {
      trackPct: pct,
      timeElapsedSinceStart: pct * lapTime, // Linear speed for simplicity
    });
  }

  return {
    startTime: 1000,
    finishTime: 1000 + lapTime,
    refPoints,
    lastTrackedPct: 1,
  };
};

// Import mocked functions after vi.mock
const { useFocusCarIdx, useTelemetryValues, useSessionStore } =
  await import('@irdashies/context');
const { useDriverStandings } = await import('./useDriverPositions');

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

describe('useDriverRelatives', () => {
  const mockCarIdxLapDistPct = [0.5, 0.6, 0.4]; // Player, Ahead, Behind
  // CarIdxEstTime: same class cars, delta = otherEstTime - playerEstTime
  // For car 1 (ahead): 109 - 99 = +10 seconds ahead
  // For car 2 (behind): 89 - 99 = -10 seconds behind
  const mockCarIdxEstTime = [99, 109, 89]; // Player, Ahead (+10), Behind (-10)

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useReferenceRegistry).mockReturnValue({
      collectLapData: vi.fn(),
      getReferenceLap: vi.fn().mockReturnValue({
        startTime: 0,
        finishTime: 0,
        refPoints: new Map(),
        lastTrackedPct: 0,
      }),
    });

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

    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      // Player (Idx 0) at 50% (50s into 100s lap)
      // Opponent (Idx 2) at 40% (32s into 80s lap)
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6, 0.4];
      if (key === 'CarIdxEstTime') return [50, 60, 32];
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 2);

    // CALCULATION PROOF:
    // Physical Gap: 10% of track.
    // Threat Pace (LMP2): 80s lap time.
    // Time to close gap: 10% of 80s = 8s.
    // Direction: Behind (-).
    // Result: -8.0s
    expect(opponent?.delta).toBeCloseTo(-8);
  });

  it('should scale delta correctly for multiclass (faster car ahead)', () => {
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

    vi.mocked(useTelemetryValues).mockImplementation((key: string) => {
      // Player (Idx 0) at 50% (50s into 100s lap)
      // Opponent (Idx 2) at 60% (48s into 80s lap)
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6, 0.6];
      if (key === 'CarIdxEstTime') return [50, 60, 48];
      return [];
    });

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 2);

    // CALCULATION PROOF:
    // Physical Gap: 10% of track (0.6 - 0.5).
    // Chaser Pace (Player/GT3): 100s lap time.
    // Time for ME to close the gap: 10% of 100s = 10s.
    // Direction: Ahead (+).
    // Result: +10.0s
    expect(opponent?.delta).toBeCloseTo(10);
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
});

describe('useDriverRelatives - Reference Lap Calculations', () => {
  const mockGetReferenceLap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReferenceRegistry).mockReturnValue({
      collectLapData: vi.fn(),
      getReferenceLap: mockGetReferenceLap,
    });
  });

  it('should use reference lap for precise gap AHEAD (Same Class)', () => {
    // SETUP: Player and Opponent in same class (100s lap)
    const lapData = generateReferenceLap(100);
    mockGetReferenceLap.mockReturnValue(lapData);

    // Player at 50% (50s), Opponent at 52% (52s)
    vi.mocked(useTelemetryValues).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.52];
      if (key === 'CarIdxEstTime') return [50, 52]; // Add this
      if (key === 'CarIdxOnPitRoad') return [false, false]; // Add this
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue([
      { ...mockDrivers[0], carIdx: 0 },
      { ...mockDrivers[1], carIdx: 1 },
    ]);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    console.log(result);
    const opponent = result.current.find((d) => d.carIdx === 1);
    console.log(opponent);

    // LOGIC: Uses Player's Ref Lap
    // Opponent (52s) - Player (50s) = +2.0s
    expect(opponent?.delta).toBeCloseTo(2.0);
  });

  it('should use reference lap for precise gap BEHIND (Same Class)', () => {
    // SETUP: Player and Opponent in same class (100s lap)
    const lapData = generateReferenceLap(100);
    mockGetReferenceLap.mockReturnValue(lapData);

    // Player at 50% (50s), Opponent at 48% (48s)
    vi.mocked(useTelemetryValues).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.48];
      if (key === 'CarIdxEstTime') return [50, 48];
      if (key === 'CarIdxOnPitRoad') return [false, false];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue([
      { ...mockDrivers[0], carIdx: 0 },
      { ...mockDrivers[1], carIdx: 1 },
    ]);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 1);

    // LOGIC: Uses Opponent's Ref Lap (which is identical to Player's here)
    // Opponent (48s) - Player (50s) = -2.0s
    expect(opponent?.delta).toBeCloseTo(-2.0);
  });

  it('should handle Wrap-Around correctly (Car Behind across Start/Finish)', () => {
    const lapData = generateReferenceLap(100);
    mockGetReferenceLap.mockReturnValue(lapData);

    // Player just started (1%), Opponent finishing (99%)
    // Physical gap: 2% (Behind)
    vi.mocked(useTelemetryValues).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return [0.01, 0.99];
      if (key === 'CarIdxEstTime') return [1, 99];
      if (key === 'CarIdxOnPitRoad') return [false, false];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue([
      { ...mockDrivers[0], carIdx: 0 },
      { ...mockDrivers[1], carIdx: 1 },
    ]);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 1);

    // RAW MATH: Opponent (99s) - Player (1s) = +98s
    // WRAP FIX: +98s > (100/2) -> 98 - 100 = -2s
    expect(opponent?.delta).toBeCloseTo(-2.0);
  });

  it('should switch reference laps for Multi-Class Threat (Fast Car Behind)', () => {
    // SETUP:
    // Player (GT3): 100s Lap
    // Opponent (GTP): 80s Lap (Faster)
    const gt3Lap = generateReferenceLap(100);
    const gtpLap = generateReferenceLap(80);

    mockGetReferenceLap.mockImplementation((idx) => {
      return idx === 0 ? gt3Lap : gtpLap;
    });

    // Player at 50%
    // Opponent at 40% (Behind)
    // Physical Distance: 10%
    vi.mocked(useTelemetryValues).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.4];
      if (key === 'CarIdxEstTime') return [50, 32];
      if (key === 'CarIdxOnPitRoad') return [false, false];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue([
      { ...mockDrivers[0], carIdx: 0 }, // GT3
      { ...mockDrivers[2], carIdx: 2 }, // GTP
    ]);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 2);

    // LOGIC: Car Behind -> Use THEIR Reference Lap (GTP/80s)
    // Player pos (0.5) on GTP Lap = 40s (0.5 * 80)
    // Opponent pos (0.4) on GTP Lap = 32s (0.4 * 80)
    // Delta: 32s - 40s = -8.0s
    expect(opponent?.delta).toBeCloseTo(-8.0);
  });

  it('should use Player reference for Multi-Class Chase (Fast Car Ahead)', () => {
    // SETUP:
    // Player (GT3): 100s Lap
    // Opponent (GTP): 80s Lap
    const gt3Lap = generateReferenceLap(100);
    const gtpLap = generateReferenceLap(80);

    mockGetReferenceLap.mockImplementation((idx) => {
      return idx === 0 ? gt3Lap : gtpLap;
    });

    // Player at 50%
    // Opponent at 60% (Ahead)
    // Physical Distance: 10%
    vi.mocked(useTelemetryValues).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return [0.5, 0.6];
      if (key === 'CarIdxEstTime') return [50, 48];
      if (key === 'CarIdxOnPitRoad') return [false, false];
      return [];
    });
    vi.mocked(useDriverStandings).mockReturnValue([
      { ...mockDrivers[0], carIdx: 0 },
      { ...mockDrivers[2], carIdx: 2 },
    ]);

    const { result } = renderHook(() => useDriverRelatives({ buffer: 2 }));
    const opponent = result.current.find((d) => d.carIdx === 2);

    // LOGIC: Car Ahead -> Use MY Reference Lap (GT3/100s)
    // "How long for ME to catch them?"
    // Player pos (0.5) on GT3 Lap = 50s
    // Opponent pos (0.6) on GT3 Lap = 60s
    // Delta: 60s - 50s = +10.0s
    expect(opponent?.delta).toBeCloseTo(10.0);
  });
});
