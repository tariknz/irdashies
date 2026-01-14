import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCustomShiftPoints } from './useCustomShiftPoints';
import * as TelemetryStore from '../../../context/TelemetryStore/TelemetryStore';
import * as CarTachometerData from './useCarTachometerData';
import type { ShiftPointSettings } from '../../Settings/types';

// Mock the dependencies
vi.mock('../../../context/TelemetryStore/TelemetryStore');
vi.mock('./useCarTachometerData');

const mockUseTelemetryValue = vi.mocked(TelemetryStore.useTelemetryValue);
const mockUseCarTachometerData = vi.mocked(CarTachometerData.useCarTachometerData);

describe('useCustomShiftPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockUseTelemetryValue.mockImplementation((key) => {
      if (key === 'Gear') return 1;
      if (key === 'RPM') return 6500;
      return 0;
    });
    
    mockUseCarTachometerData.mockReturnValue({
      carData: {
        carName: 'Ferrari 296 GT3',
        carId: 'ferrari296gt3',
        carClass: 'GT3',
        ledNumber: 6,
        redlineBlinkInterval: 250,
        ledColor: [],
        ledRpm: []
      },
      loading: false,
      gearRpmThresholds: null,
      hasCarData: true,
    });
  });

  it('returns no shift indicator when disabled', () => {
    const settings: ShiftPointSettings = {
      enabled: false,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {}
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
        'ferrari296gt3': {
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          gearShiftPoints: {
            '1': { shiftRpm: 6000 }
          }
        }
      }
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(true);
    expect(result.current.indicatorType).toBe('glow');
    expect(result.current.indicatorColor).toBe('#00ff00');
    expect(result.current.currentShiftPoint).toBe(6000);
  });

  it('does not show shift indicator when RPM below custom shift point', () => {
    mockUseTelemetryValue.mockImplementation((key) => {
      if (key === 'Gear') return 1;
      if (key === 'RPM') return 5500; // Below shift point
      return 0;
    });

    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        'ferrari296gt3': {
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          gearShiftPoints: {
            '1': { shiftRpm: 6000 }
          }
        }
      }
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });

  it('does not show shift indicator in neutral or reverse', () => {
    mockUseTelemetryValue.mockImplementation((key) => {
      if (key === 'Gear') return 0; // Neutral
      if (key === 'RPM') return 6500;
      return 0;
    });

    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        'ferrari296gt3': {
          carId: 'ferrari296gt3',
          carName: 'Ferrari 296 GT3',
          gearCount: 6,
          gearShiftPoints: {
            '0': { shiftRpm: 6000 }
          }
        }
      }
    };

    const { result } = renderHook(() => useCustomShiftPoints(settings));

    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });
});