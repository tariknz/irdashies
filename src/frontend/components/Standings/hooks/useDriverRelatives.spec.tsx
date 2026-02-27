import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDriverRelatives } from './useDriverRelatives';
import type { Standings } from '../createStandings';
import {
  calculateClassEstimatedGap,
  calculateReferenceDelta,
  getStats,
  getTimeAtPosition,
} from '../relativeGapHelpers';
import {
  normalizeKey,
  REFERENCE_INTERVAL,
} from '../../../context/ReferenceLapStore/ReferenceLapStore';
import { ReferenceLap, ReferencePoint } from '@irdashies/types';

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

// =============================================================================
// HELPER: Generate a full Reference Lap with Tangents
// =============================================================================
const generateReferenceLap = (lapTime: number): ReferenceLap => {
  const refPoints = new Map<number, ReferencePoint>();

  // 400 points = 100% / 0.25%
  const totalPoints = Math.round(1 / REFERENCE_INTERVAL);

  for (let i = 0; i <= totalPoints; i++) {
    // Clean float generation: 0, 0.0025, 0.0050 ... 1.0
    const pct = i * REFERENCE_INTERVAL + 0.00001;

    const key = normalizeKey(pct);

    refPoints.set(key, {
      trackPct: pct,
      timeElapsedSinceStart: pct * lapTime, // Linear speed
      // CRITICAL FOR FRITSCH-CARLSON:
      // For a perfectly linear lap (y = mx), the tangent (slope) is constant.
      // Slope = Rise / Run = LapTime / 1.0 = LapTime.
      tangent: lapTime,
    } as ReferencePoint);
  }

  const startTime = 1000;

  return {
    startTime: startTime,
    finishTime: startTime + lapTime,
    refPoints,
    lastTrackedPct: 1,
  } as ReferenceLap;
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
        resetSession: vi.fn(),
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

describe('getStats', () => {
  it('should return stats with driver estLapTime', () => {
    const driver = { ...mockDrivers[0] };
    const estTime = 50;
    const result = getStats(estTime, driver);

    expect(result).toEqual({
      estTime: estTime,
      classEstTime: mockDrivers[0].carClass.estLapTime,
    });
  });

  it('should use fallback lap time when driver is undefined', () => {
    const result = getStats(50, undefined);

    expect(result).toEqual({
      estTime: 50,
      classEstTime: 90, // FALLBACK_LAPTIME
    });
  });
});

describe('calculateClassEstimatedGap', () => {
  describe('Same Class (1:1 scaling)', () => {
    it('should calculate positive gap for car ahead (same class)', () => {
      const carAhead = { estTime: 60, classEstTime: 100 };
      const carBehind = { estTime: 50, classEstTime: 100 };

      const result = calculateClassEstimatedGap(carAhead, carBehind, true);

      // Delta = 60 - 50 = +10s
      expect(result).toBeCloseTo(10);
    });

    it('should calculate negative gap for car behind (same class)', () => {
      const carAhead = { estTime: 50, classEstTime: 100 };
      const carBehind = { estTime: 40, classEstTime: 100 };

      const result = calculateClassEstimatedGap(carAhead, carBehind, false);

      // Delta = 40 - 50 = -10s
      expect(result).toBeCloseTo(-10);
    });

    it('should handle wrap-around for car ahead (same class)', () => {
      // Car ahead just crossed finish (1s), car behind finishing lap (99s)
      const carAhead = { estTime: 1, classEstTime: 100 };
      const carBehind = { estTime: 99, classEstTime: 100 };

      const result = calculateClassEstimatedGap(carAhead, carBehind, true);

      // Raw: 1 - 99 = -98s
      // Wrapped: -98 + 100 = +2s (ahead just crossed)
      expect(result).toBeCloseTo(2);
    });

    it('should handle wrap-around for car behind (same class)', () => {
      // Car ahead finishing lap (99s), car behind just crossed (1s)
      const carAhead = { estTime: 99, classEstTime: 100 };
      const carBehind = { estTime: 1, classEstTime: 100 };

      const result = calculateClassEstimatedGap(carAhead, carBehind, false);

      // Raw: 1 - 99 = -98s
      // This is already negative, no wrap needed
      expect(result).toBeCloseTo(-98);
    });
  });

  describe('Multi-Class: Faster Car Ahead (GTP ahead of GT3)', () => {
    it('should scale gap correctly when faster car is ahead', () => {
      // GT3 (player) at 50% = 50s into 100s lap
      // GTP (ahead) at 60% = 48s into 80s lap
      const carAhead = { estTime: 48, classEstTime: 80 }; // GTP
      const carBehind = { estTime: 50, classEstTime: 100 }; // GT3

      const result = calculateClassEstimatedGap(carAhead, carBehind, true);

      // Scaling: 100/80 = 1.25
      // Scaled ahead: 48 * 1.25 = 60s
      // Delta: 60 - 50 = +10s
      expect(result).toBeCloseTo(10);
    });
  });

  describe('Multi-Class: Faster Car Behind (GTP behind GT3)', () => {
    it('should scale gap correctly when faster car is behind', () => {
      // GT3 (player) at 50% = 50s into 100s lap
      // GTP (behind) at 40% = 32s into 80s lap
      const carAhead = { estTime: 50, classEstTime: 100 }; // GT3
      const carBehind = { estTime: 32, classEstTime: 80 }; // GTP

      const result = calculateClassEstimatedGap(carAhead, carBehind, false);

      // Scaling: 80/100 = 0.8
      // Scaled ahead: 50 * 0.8 = 40s
      // Delta: 32 - 40 = -8s
      expect(result).toBeCloseTo(-8);
    });
  });

  describe('Multi-Class: Slower Car Ahead (GT3 ahead of GTP)', () => {
    it('should scale gap correctly when slower car is ahead', () => {
      // GTP (player) at 40% = 32s into 80s lap
      // GT3 (ahead) at 50% = 50s into 100s lap
      const carAhead = { estTime: 50, classEstTime: 100 }; // GT3
      const carBehind = { estTime: 32, classEstTime: 80 }; // GTP

      const result = calculateClassEstimatedGap(carAhead, carBehind, true);

      // Scaling: 80/100 = 0.8
      // Scaled ahead: 50 * 0.8 = 40s
      // Delta: 40 - 32 = +8s
      expect(result).toBeCloseTo(8);
    });
  });

  describe('Multi-Class: Slower Car Behind (GT3 behind GTP)', () => {
    it('should scale gap correctly when slower car is behind', () => {
      // GTP (player) at 60% = 48s into 80s lap
      // GT3 (behind) at 50% = 50s into 100s lap
      const carAhead = { estTime: 48, classEstTime: 80 }; // GTP
      const carBehind = { estTime: 50, classEstTime: 100 }; // GT3

      const result = calculateClassEstimatedGap(carAhead, carBehind, false);

      // Scaling: 100/80 = 1.25
      // Scaled ahead: 48 * 1.25 = 60s
      // Delta: 50 - 60 = -10s
      expect(result).toBeCloseTo(-10);
    });
  });
});

describe('getTimeAtPosition', () => {
  it('should interpolate time at exact reference point', () => {
    const refLap = generateReferenceLap(100);

    // At 50% through 100s lap = 50s
    const result = getTimeAtPosition(refLap, 0.5);

    expect(result).toBeCloseTo(50);
  });

  it('should interpolate time between reference points', () => {
    const refLap = generateReferenceLap(100);

    // At 50.125% (halfway between 50% and 50.25%)
    // Should be 50.125s
    const result = getTimeAtPosition(refLap, 0.50125);

    expect(result).toBeCloseTo(50.125);
  });

  it('should handle position near start (0%)', () => {
    const refLap = generateReferenceLap(100);

    const result = getTimeAtPosition(refLap, 0.01);

    expect(result).toBeCloseTo(1);
  });

  it('should handle position near finish (100%)', () => {
    const refLap = generateReferenceLap(100);

    const result = getTimeAtPosition(refLap, 0.99);

    expect(result).toBeCloseTo(99);
  });
});

describe('calculateReferenceDelta', () => {
  it('should calculate positive delta for opponent ahead (same class)', () => {
    const refLap = generateReferenceLap(100);

    // Player at 50%, opponent at 52%
    const result = calculateReferenceDelta(refLap, 0.52, 0.5);

    // Opponent: 52s, Player: 50s
    // Delta: 52 - 50 = +2s
    expect(result).toBeCloseTo(2);
  });

  it('should calculate negative delta for opponent behind (same class)', () => {
    const refLap = generateReferenceLap(100);

    // Player at 50%, opponent at 48%
    const result = calculateReferenceDelta(refLap, 0.48, 0.5);

    // Opponent: 48s, Player: 50s
    // Delta: 48 - 50 = -2s
    expect(result).toBeCloseTo(-2);
  });

  it('should handle wrap-around when opponent crosses start/finish', () => {
    const refLap = generateReferenceLap(100);

    // Player just started (1%), opponent finishing (99%)
    const result = calculateReferenceDelta(refLap, 0.99, 0.01);

    // Raw: 99 - 1 = +98s
    // Wrapped: 98 - 100 = -2s (opponent is behind)
    expect(result).toBeCloseTo(-2);
  });

  it('should handle wrap-around when player crosses start/finish', () => {
    const refLap = generateReferenceLap(100);

    // Player finishing (99%), opponent just started (1%)
    const result = calculateReferenceDelta(refLap, 0.01, 0.99);

    // Raw: 1 - 99 = -98s
    // Wrapped: -98 + 100 = +2s (opponent is ahead)
    expect(result).toBeCloseTo(2);
  });

  it('should work with different lap times', () => {
    const refLap = generateReferenceLap(80); // 80s lap

    // Player at 50%, opponent at 60%
    const result = calculateReferenceDelta(refLap, 0.6, 0.5);

    // Opponent: 48s (0.6 * 80), Player: 40s (0.5 * 80)
    // Delta: 48 - 40 = +8s
    expect(result).toBeCloseTo(8);
  });
});
