import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  useSessionDrivers,
  useWeekendInfoNumCarClasses,
} from '@irdashies/context';
import { useIsSingleMake } from './useIsSingleMake';
import type { Driver } from '@irdashies/types';

vi.mock('@irdashies/context');

const SINGLE_MAKE_DRIVERS = [
  { CarID: 1, CarIsPaceCar: false, IsSpectator: false },
  { CarID: 1, CarIsPaceCar: false, IsSpectator: false },
] as unknown as Driver[];

describe('useIsSingleMake', () => {
  it('returns false without scanning drivers when disabled', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(SINGLE_MAKE_DRIVERS);
    vi.mocked(useWeekendInfoNumCarClasses).mockReturnValue(1);

    const { result } = renderHook(() => useIsSingleMake(false));

    expect(result.current).toBe(false);
  });

  it('recomputes correctly from live data when toggled on mid-session', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(SINGLE_MAKE_DRIVERS);
    vi.mocked(useWeekendInfoNumCarClasses).mockReturnValue(1);

    const { result, rerender } = renderHook(
      ({ enabled }) => useIsSingleMake(enabled),
      { initialProps: { enabled: false } }
    );
    expect(result.current).toBe(false);

    rerender({ enabled: true });

    expect(result.current).toBe(true);
  });

  it('returns false when multi-class even while enabled', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(SINGLE_MAKE_DRIVERS);
    vi.mocked(useWeekendInfoNumCarClasses).mockReturnValue(2);

    const { result } = renderHook(() => useIsSingleMake(true));

    expect(result.current).toBe(false);
  });
});
