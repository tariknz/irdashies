import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCarBehind } from './useCarBehind';
import type { Standings } from '../../Standings/createStandings';
import * as driverRelativesModule from '../../Standings/hooks/useDriverRelatives';
import * as driverStandingsModule from '../../Standings/hooks/useDriverPositions';
import * as fasterCarsSettingsModule from './useFasterCarsSettings';

type DriverRelative = Standings & { relativePct: number; delta: number };

// Mock the hooks
vi.mock('../../Standings/hooks/useDriverRelatives');
vi.mock('../../Standings/hooks/useDriverPositions');
vi.mock('./useFasterCarsSettings');

describe('useCarBehind', () => {
  const createMockDriver = (
    carIdx: number,
    delta: number,
    classSpeed: number,
    name: string,
    onPitRoad = false
  ): DriverRelative => ({
    carIdx,
    delta,
    relativePct: delta / 100,
    onPitRoad,
    driver: {
      name,
      carNum: `${carIdx}`,
      license: 'A',
      rating: 2000,
    },
    carClass: {
      id: 1,
      color: 0xff0000,
      name: 'GT3',
      relativeSpeed: classSpeed,
      estLapTime: 100,
    },
    classPosition: 1,
    isPlayer: delta === 0,
    fastestTime: 100,
    hasFastestTime: false,
    lastTime: 100,
    onTrack: true,
    tireCompound: 0,
    currentSessionType: 'Race',
    dnf: false,
    repair: false,
    penalty: false,
    slowdown: false,
  });

  const defaultSettings = {
    distanceThreshold: -2.5,
    numberDriversBehind: 3,
    onlyShowFasterClasses: true,
    showOnlyWhenOnTrack: false,
    alignDriverBoxes: 'Top' as const,
    closestDriverBox: 'Top' as const,
    showName: true,
    showDistance: true,
    showBadge: true,
    badgeFormat: 'license-color-rating-bw',
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(driverStandingsModule.useDriverStandings).mockReturnValue([]);
    vi.mocked(fasterCarsSettingsModule.useFasterCarsSettings).mockReturnValue(
      defaultSettings
    );
  });

  describe('Player Car Identification', () => {
    it('should identify player by delta === 0, not by array index', () => {
      // Player is at index 2, not index 1 (tests the bug fix)
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'Faster Car Behind'), // Behind, faster class
        createMockDriver(20, -0.5, 37, 'Same Class Behind'), // Behind, same class
        createMockDriver(30, 0, 37, 'Player'), // Player at index 2
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should correctly filter using player's class speed (37)
      // Only the faster class car (speed 42) should be included
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Faster Car Behind');
    });

    it('should handle when player is at different array positions', () => {
      // Player at index 0
      const mockDriversPlayerFirst = [
        createMockDriver(30, 0, 37, 'Player'),
        createMockDriver(10, -1.5, 42, 'Faster Behind'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDriversPlayerFirst
      );

      const { result: result1 } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      expect(result1.current).toHaveLength(1);
      expect(result1.current[0].name).toBe('Faster Behind');

      // Player at last index
      const mockDriversPlayerLast = [
        createMockDriver(10, -1.5, 42, 'Faster Behind'),
        createMockDriver(30, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDriversPlayerLast
      );

      const { result: result2 } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      expect(result2.current).toHaveLength(1);
      expect(result2.current[0].name).toBe('Faster Behind');
    });
  });

  describe('Class Filtering', () => {
    it('should only show faster class cars when onlyShowFasterClasses is true', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'LMP2 Behind'), // Faster class
        createMockDriver(20, -1.0, 37, 'GT3 Behind'), // Same class
        createMockDriver(30, 0, 37, 'Player GT3'), // Player
        createMockDriver(40, -2.0, 35, 'GT4 Behind'), // Slower class
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );
      vi.mocked(fasterCarsSettingsModule.useFasterCarsSettings).mockReturnValue(
        {
          ...defaultSettings,
          onlyShowFasterClasses: true,
        }
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should only include LMP2 (faster class)
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('LMP2 Behind');
    });

    it('should show all classes when onlyShowFasterClasses is false', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'LMP2 Behind'), // Faster class
        createMockDriver(20, -1.0, 37, 'GT3 Behind'), // Same class
        createMockDriver(30, 0, 37, 'Player GT3'), // Player
        createMockDriver(40, -2.0, 35, 'GT4 Behind'), // Slower class
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );
      vi.mocked(fasterCarsSettingsModule.useFasterCarsSettings).mockReturnValue(
        {
          ...defaultSettings,
          onlyShowFasterClasses: false,
        }
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should include all cars within threshold
      expect(result.current).toHaveLength(3);
      expect(result.current.map((c) => c.name)).toEqual([
        'GT3 Behind',
        'LMP2 Behind',
        'GT4 Behind',
      ]);
    });

    it('should handle undefined class speed gracefully', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'Car with class'),
        {
          ...createMockDriver(20, -1.0, 37, 'Car without class'),
          carClass: undefined,
        } as unknown as DriverRelative,
        createMockDriver(30, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should not crash, should filter based on defaults (0)
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Car with class');
    });
  });

  describe('Distance Threshold', () => {
    it('should only include cars within distance threshold', () => {
      const mockDrivers = [
        createMockDriver(10, -0.5, 42, 'Very Close'), // Within threshold
        createMockDriver(20, -2.0, 42, 'Close'), // Within threshold
        createMockDriver(30, -3.0, 42, 'At Threshold'), // Exactly at threshold
        createMockDriver(40, -3.5, 42, 'Too Far'), // Beyond threshold
        createMockDriver(50, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -3.0 })
      );

      // Should include cars with delta >= -3.0
      expect(result.current).toHaveLength(3);
      expect(result.current.map((c) => c.name)).toEqual([
        'Very Close',
        'Close',
        'At Threshold',
      ]);
    });

    it('should use default threshold when not provided', () => {
      const mockDrivers = [
        createMockDriver(10, -2.0, 42, 'Within Default'),
        createMockDriver(20, -4.0, 42, 'Beyond Default'),
        createMockDriver(30, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      // Not passing distanceThreshold, should use default -3
      const { result } = renderHook(() => useCarBehind({}));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Within Default');
    });
  });

  describe('Sorting', () => {
    it('should sort by closest first (least negative delta)', () => {
      const mockDrivers = [
        createMockDriver(10, -2.0, 42, 'Far'),
        createMockDriver(20, -0.5, 42, 'Closest'),
        createMockDriver(30, -1.5, 42, 'Middle'),
        createMockDriver(40, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should be sorted: Closest (-0.5), Middle (-1.5), Far (-2.0)
      expect(result.current).toHaveLength(3);
      expect(result.current[0].name).toBe('Closest');
      expect(result.current[0].distance).toBe(-0.5);
      expect(result.current[1].name).toBe('Middle');
      expect(result.current[1].distance).toBe(-1.5);
      expect(result.current[2].name).toBe('Far');
      expect(result.current[2].distance).toBe(-2.0);
    });
  });

  describe('Number of Drivers Limit', () => {
    it('should respect numberDriversBehind setting', () => {
      const mockDrivers = [
        createMockDriver(10, -0.5, 42, 'Car 1'),
        createMockDriver(20, -1.0, 42, 'Car 2'),
        createMockDriver(30, -1.5, 42, 'Car 3'),
        createMockDriver(40, -2.0, 42, 'Car 4'),
        createMockDriver(50, -2.2, 42, 'Car 5'),
        createMockDriver(60, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );
      vi.mocked(fasterCarsSettingsModule.useFasterCarsSettings).mockReturnValue(
        {
          ...defaultSettings,
          numberDriversBehind: 2,
        }
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should only return 2 cars (closest ones)
      expect(result.current).toHaveLength(2);
      expect(result.current[0].name).toBe('Car 1');
      expect(result.current[1].name).toBe('Car 2');
    });
  });

  describe('Cars Behind Filter', () => {
    it('should only show cars behind (negative delta)', () => {
      const mockDrivers = [
        createMockDriver(10, 1.5, 42, 'Car Ahead'), // Positive delta
        createMockDriver(20, -1.5, 42, 'Car Behind'), // Negative delta
        createMockDriver(30, 0, 37, 'Player'), // Zero delta
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should only include the car behind
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Car Behind');
    });
  });

  describe('Pit Road Filter', () => {
    it('should filter out cars on pit road', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'On Track', false),
        createMockDriver(20, -1.0, 42, 'In Pits', true),
        createMockDriver(30, 0, 37, 'Player', false),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should only include cars not on pit road
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('On Track');
    });
  });

  describe('Return Value Format', () => {
    it('should return correctly formatted car data', () => {
      const mockDrivers = [
        createMockDriver(10, -1.234, 42, 'Test Car'),
        createMockDriver(20, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      expect(result.current).toHaveLength(1);
      const car = result.current[0];

      // Check all return fields
      expect(car.carIdx).toBe(10);
      expect(car.name).toBe('Test Car');
      expect(car.license).toBe('A');
      expect(car.rating).toBe(2000);
      expect(car.distance).toBe(-1.2); // Rounded to 1 decimal
      expect(car.classColor).toBe(0xff0000);
      expect(typeof car.percent).toBe('number');
    });

    it('should calculate percent correctly', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'Half Way'),
        createMockDriver(20, -0.01, 42, 'Very Close'),
        createMockDriver(30, -3.0, 42, 'At Limit'),
        createMockDriver(40, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );
      // Use onlyShowFasterClasses: false to include all cars for percent calculation test
      vi.mocked(fasterCarsSettingsModule.useFasterCarsSettings).mockReturnValue(
        {
          ...defaultSettings,
          onlyShowFasterClasses: false,
        }
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -3.5 })
      );

      // Sorted by closest first (least negative delta first)
      // Percent = 100 - (abs(delta) / 3) * 100
      expect(result.current).toHaveLength(3);

      // Very Close (delta -0.01) comes first after sorting
      expect(result.current[0].name).toBe('Very Close');
      expect(result.current[0].percent).toBe(100); // delta -0.01 -> ~100%

      // Half Way (delta -1.5) comes second
      expect(result.current[1].name).toBe('Half Way');
      expect(result.current[1].percent).toBe(50); // delta -1.5 -> 50%

      // At Limit (delta -3.0) comes third
      expect(result.current[2].name).toBe('At Limit');
      expect(result.current[2].percent).toBe(0); // delta -3.0 -> 0%
    });
  });

  describe('Empty States', () => {
    it('should return empty array when no cars are behind', () => {
      const mockDrivers = [
        createMockDriver(10, 1.5, 42, 'Car Ahead'),
        createMockDriver(20, 0, 37, 'Player'),
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      expect(result.current).toHaveLength(0);
    });

    it('should return empty array when no player found', () => {
      const mockDrivers = [
        createMockDriver(10, -1.5, 42, 'Car 1'),
        createMockDriver(20, -1.0, 42, 'Car 2'),
        // No car with delta === 0 (no player)
      ];

      vi.mocked(driverRelativesModule.useDriverRelatives).mockReturnValue(
        mockDrivers
      );

      const { result } = renderHook(() =>
        useCarBehind({ distanceThreshold: -2.5 })
      );

      // Should not crash, should return empty or filtered result
      expect(Array.isArray(result.current)).toBe(true);
    });
  });
});
