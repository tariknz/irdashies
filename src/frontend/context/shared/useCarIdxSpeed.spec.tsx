import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCarSpeedsSnapshot } from '../ChannelStore';
import { useCarIdxSpeed } from './useCarIdxSpeed';

vi.mock('../ChannelStore', () => ({ useCarSpeedsSnapshot: vi.fn() }));

describe('useCarIdxSpeed', () => {
  it('returns an empty array before the channel is seeded', () => {
    vi.mocked(useCarSpeedsSnapshot).mockReturnValue(undefined);
    const { result } = renderHook(() => useCarIdxSpeed());
    expect(result.current).toEqual([]);
    expect(useCarSpeedsSnapshot).toHaveBeenCalledWith(true);
  });

  it('keeps the channel disabled when the feature is disabled', () => {
    vi.mocked(useCarSpeedsSnapshot).mockReturnValue(undefined);
    renderHook(() => useCarIdxSpeed(false));
    expect(useCarSpeedsSnapshot).toHaveBeenCalledWith(false);
  });

  it('returns the processor-owned car speeds', () => {
    vi.mocked(useCarSpeedsSnapshot).mockReturnValue({
      carSpeeds: [100, 120],
      sessionNum: 1,
      version: 2,
    });
    const { result } = renderHook(() => useCarIdxSpeed());
    expect(result.current).toEqual([100, 120]);
  });
});
