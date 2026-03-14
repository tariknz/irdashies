import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCarTachometerData } from './useCarTachometerData';
import * as Context from '@irdashies/context';

// Mock the dependencies
vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useSessionStore: vi.fn(),
    useDriverCarIdx: vi.fn(),
    useTelemetryValue: vi.fn(),
  };
});
vi.mock('../../../utils/carData');

const mockUseSessionStore = vi.mocked(Context.useSessionStore);
const mockUseDriverCarIdx = vi.mocked(Context.useDriverCarIdx);
const mockUseTelemetryValue = vi.mocked(Context.useTelemetryValue);

describe('useCarTachometerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseDriverCarIdx.mockReturnValue(0);
    mockUseTelemetryValue.mockReturnValue(1); // Gear 1
    mockUseSessionStore.mockReturnValue({
      session: {
        DriverInfo: {
          Drivers: [{ CarIdx: 0, CarPath: 'porsche992rgt3' }],
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });

  it('returns null when no car path is available', () => {
    mockUseSessionStore.mockReturnValue({
      session: {
        DriverInfo: {
          Drivers: [],
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });

  it('returns null when session is null', () => {
    mockUseSessionStore.mockReturnValue({
      session: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useCarTachometerData());

    expect(result.current.carData).toBeNull();
    expect(result.current.hasCarData).toBe(false);
    expect(result.current.gearRpmThresholds).toBeNull();
  });
});
