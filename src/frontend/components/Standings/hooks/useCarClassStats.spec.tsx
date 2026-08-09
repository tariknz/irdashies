import { renderHook } from '@testing-library/react';
import { useCarClassStats } from './useCarClassStats';
import { describe, it, vi, expect } from 'vitest';
import { useSessionDrivers } from '@irdashies/context';
import type { Driver } from '@irdashies/types';

vi.mock('@irdashies/context');

describe('useCarClassStats', () => {
  const mockDrivers = [
    {
      CarClassID: '1',
      CarClassColor: 123456,
      CarClassShortName: 'GT3',
      IRating: 1000,
    },
    {
      CarClassID: '1',
      CarClassColor: 123456,
      CarClassShortName: 'GT3',
      IRating: 2000,
    },
    {
      CarClassID: '1',
      CarClassColor: 123456,
      CarClassShortName: 'GT3',
      IRating: 2250,
    },
    {
      CarClassID: '1',
      CarClassColor: 123456,
      CarClassShortName: 'GT3',
      IRating: 1950,
    },
    {
      CarClassID: '2',
      CarClassColor: 654321,
      CarClassShortName: 'LMP2',
      IRating: 3000,
    },
  ] as unknown as Driver[];

  it('should return correct class stats', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers);
    const { result } = renderHook(() => useCarClassStats());

    expect(result.current).toEqual({
      '1': {
        total: 4,
        color: 123456,
        shortName: 'GT3',
        sof: 1748,
      },
      '2': {
        total: 1,
        color: 654321,
        shortName: 'LMP2',
        sof: 3000,
      },
    });
  });

  it('should not error if session is not available', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(undefined);
    const { result } = renderHook(() => useCarClassStats());

    expect(result.current).toBeUndefined();
  });

  it('returns header data for AI classes without an iRating', () => {
    vi.mocked(useSessionDrivers).mockReturnValue([
      {
        CarClassID: 1,
        CarClassColor: 123456,
        CarClassShortName: null,
        CarID: 132,
        IRating: 0,
      },
      {
        CarClassID: 1,
        CarClassColor: 123456,
        CarClassShortName: null,
        CarID: 133,
        IRating: -1,
      },
      {
        CarClassID: 2,
        CarClassColor: 654321,
        CarClassShortName: null,
        CarID: 128,
        IRating: 0,
      },
    ] as unknown as Driver[]);

    const { result } = renderHook(() => useCarClassStats());

    expect(result.current).toEqual({
      '1': {
        total: 2,
        color: 123456,
        shortName: 'GT3',
        sof: undefined,
      },
      '2': {
        total: 1,
        color: 654321,
        shortName: 'LMP2',
        sof: undefined,
      },
    });
  });

  it('counts AI drivers but excludes them from SOF', () => {
    vi.mocked(useSessionDrivers).mockReturnValue([
      ...mockDrivers.slice(0, 2),
      {
        CarClassID: '1',
        CarClassColor: 123456,
        CarClassShortName: 'GT3',
        IRating: 0,
      },
    ] as unknown as Driver[]);

    const { result } = renderHook(() => useCarClassStats());

    expect(result.current?.['1']).toEqual({
      total: 3,
      color: 123456,
      shortName: 'GT3',
      sof: 1446,
    });
  });

  it('reuses class stats while driver metadata is unchanged', () => {
    vi.mocked(useSessionDrivers).mockReturnValue(mockDrivers);
    const { result, rerender } = renderHook(() => useCarClassStats());
    const initialStats = result.current;

    rerender();

    expect(result.current).toBe(initialStats);
  });
});
