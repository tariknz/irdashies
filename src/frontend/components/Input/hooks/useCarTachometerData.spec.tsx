import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCarTachometerData } from './useCarTachometerData';
import * as SessionStore from '../../../context/SessionStore/SessionStore';
import * as TelemetryStore from '../../../context/TelemetryStore/TelemetryStore';

// Mock the dependencies
vi.mock('../../../context/SessionStore/SessionStore');
vi.mock('../../../context/TelemetryStore/TelemetryStore');
vi.mock('../../../utils/carData');

const mockUseSessionStore = vi.mocked(SessionStore.useSessionStore);
const mockUseDriverCarIdx = vi.mocked(SessionStore.useDriverCarIdx);
const mockUseTelemetryValue = vi.mocked(TelemetryStore.useTelemetryValue);

describe('useCarTachometerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockUseDriverCarIdx.mockReturnValue(0);
    mockUseTelemetryValue.mockReturnValue(1); // Gear 1
    mockUseSessionStore.mockReturnValue({
      session: {
        DriverInfo: {
          Drivers: [
            { CarIdx: 0, CarPath: 'porsche992rgt3' }
          ]
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });

  it('returns null when no car path is available', () => {
    mockUseSessionStore.mockReturnValue({
      session: {
        DriverInfo: {
          Drivers: []
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });

  it('returns null when session is null', () => {
    mockUseSessionStore.mockReturnValue({
      session: null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });
});