import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentSessionType } from './useCurrentSessionType';
import { useSessionType, useTelemetryValue } from '@irdashies/context';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useSessionType: vi.fn(),
  useTelemetryValue: vi.fn(),
}));

describe('useCurrentSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return the session type when session number is available', () => {
    // Mock the telemetry value for session number
    vi.mocked(useTelemetryValue).mockReturnValue(1);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue('Race');

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBe('Race');
    expect(useTelemetryValue).toHaveBeenCalledWith('SessionNum');
    expect(useSessionType).toHaveBeenCalledWith(1);
  });

  it('should return undefined when session number is not available', () => {
    // Mock the telemetry value as undefined
    vi.mocked(useTelemetryValue).mockReturnValue(undefined);
    // Mock the session type
    vi.mocked(useSessionType).mockReturnValue(undefined);

    const { result } = renderHook(() => useCurrentSessionType());

    expect(result.current).toBeUndefined();
    expect(useTelemetryValue).toHaveBeenCalledWith('SessionNum');
    expect(useSessionType).toHaveBeenCalledWith(undefined);
  });
});
