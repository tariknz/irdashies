import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCustomShiftPoints } from './useCustomShiftPoints';
import * as Context from '@irdashies/context';
import * as CarTachometerData from './useCarTachometerData';
import type { ShiftPointSettings } from '@irdashies/types';

// Mock the dependencies
vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useDriverControlsSnapshot: vi.fn(),
  };
});
vi.mock('./useCarTachometerData');

const mockUseDriverControlsSnapshot = vi.mocked(
  Context.useDriverControlsSnapshot
);
const mockUseCarTachometerData = vi.mocked(
  CarTachometerData.useCarTachometerData
);

describe('useCustomShiftPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseDriverControlsSnapshot.mockReturnValue({
      gear: 1,
      rpm: 6500,
      version: 1,
    });

    mockUseCarTachometerData.mockReturnValue({
      carData: {
        carName: 'Ferrari 296 GT3',
        carId: 'ferrari296gt3',
        carClass: 'GT3',
        ledNumber: 6,
        redlineBlinkInterval: 250,
        ledColor: [],
        ledRpm: [],
      },

      gearRpmThresholds: null,
      hasCarData: true,
    });
  });

  it('returns no shift indicator when disabled', () => {
    const settings: ShiftPointSettings = {
      enabled: false,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {},
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });

  it('shows shift indicator when RPM exceeds custom shift point', () => {
    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        ferrari296gt3: {
          enabled: true,
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          redlineRpm: 8000,
          gearShiftPoints: {
            '1': { shiftRpm: 6000 },
          },
        },
      },
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(true);
    expect(result.current.indicatorType).toBe('glow');
    expect(result.current.indicatorColor).toBe('#00ff00');
    expect(result.current.currentShiftPoint).toBe(6000);
  });

  it('does not show shift indicator when RPM below custom shift point', () => {
    mockUseDriverControlsSnapshot.mockReturnValue({
      gear: 1,
      rpm: 5500,
      version: 2,
    });

    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        ferrari296gt3: {
          enabled: true,
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          redlineRpm: 8000,
          gearShiftPoints: {
            '1': { shiftRpm: 6000 },
          },
        },
      },
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });

  it('does not show shift indicator in neutral or reverse', () => {
    mockUseDriverControlsSnapshot.mockReturnValue({
      gear: 0,
      rpm: 6500,
      version: 2,
    });

    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        ferrari296gt3: {
          enabled: true,
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          redlineRpm: 8000,
          gearShiftPoints: {
            '0': { shiftRpm: 6000 },
          },
        },
      },
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });
});
