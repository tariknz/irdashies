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
});
