import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionBestLapStoreUpdater } from './SessionBestLapStoreUpdater';
import { useSessionBestLapStore } from './SessionBestLapStore';
import { useSessionBestLapTime } from '../../components/Standings/hooks/useSessionBestLapTime';

vi.mock('../../components/Standings/hooks/useSessionBestLapTime');

describe('useSessionBestLapStoreUpdater', () => {
  beforeEach(() => {
    useSessionBestLapStore.setState({ sessionBestLap: undefined });
    vi.mocked(useSessionBestLapTime).mockReturnValue(88.123);
  });

  it('writes the session best lap into the store when enabled', () => {
    renderHook(() => useSessionBestLapStoreUpdater(true));

    expect(useSessionBestLapStore.getState().sessionBestLap).toBe(88.123);
  });

  it('does not write to the store when disabled', () => {
    renderHook(() => useSessionBestLapStoreUpdater(false));

    expect(useSessionBestLapStore.getState().sessionBestLap).toBeUndefined();
  });
});
