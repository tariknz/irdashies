import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentSessionType } from './useCurrentSessionType';
import { useSessionType } from '@irdashies/context';
import { useTrackStateSnapshot } from '../ChannelStore';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useSessionType: vi.fn(),
}));

vi.mock('../ChannelStore', () => ({
  useTrackStateSnapshot: vi.fn(),
}));

describe('useCurrentSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return the session type when session number is available', () => {
    vi.mocked(useTrackStateSnapshot).mockReturnValue({
      sessionNum: 1,
    } as never);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue('Race');

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBe('Race');
    expect(useTrackStateSnapshot).toHaveBeenCalledOnce();
    expect(useSessionType).toHaveBeenCalledWith(1);
  });

  it('should return undefined when session number is not available', () => {
    vi.mocked(useTrackStateSnapshot).mockReturnValue(undefined);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue(undefined);

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBeUndefined();
    expect(useTrackStateSnapshot).toHaveBeenCalledOnce();
    expect(useSessionType).toHaveBeenCalledWith(undefined);
  });
});
