import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentSessionType } from './useCurrentSessionType';
import { useSessionType } from '@irdashies/context';
import { useTrackStateSelector } from '../ChannelStore';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useSessionType: vi.fn(),
}));

vi.mock('../ChannelStore', () => ({
  trackStateSelectors: { sessionNum: vi.fn() },
  useTrackStateSelector: vi.fn(),
}));

describe('useCurrentSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return the session type when session number is available', () => {
    vi.mocked(useTrackStateSelector).mockReturnValue(1);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue('Race');

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBe('Race');
    expect(useTrackStateSelector).toHaveBeenCalledOnce();
    expect(useSessionType).toHaveBeenCalledWith(1);
  });

  it('should return undefined when session number is not available', () => {
    vi.mocked(useTrackStateSelector).mockReturnValue(undefined);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue(undefined);

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBeUndefined();
    expect(useTrackStateSelector).toHaveBeenCalledOnce();
    expect(useSessionType).toHaveBeenCalledWith(undefined);
  });
});
