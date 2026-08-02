import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionTimingStoreUpdater } from './SessionTimingStoreUpdater';
import { useSessionTimingStore } from './SessionTimingStore';
import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import { useTotalRaceValue } from '../shared/useTotalRaceValue';

vi.mock('../../components/Standings/hooks/useSessionLapCount');
vi.mock('../shared/useTotalRaceValue');

const sessionLapCountResult = {
  state: 4,
  currentLap: 3,
  totalLaps: 20,
  time: 123,
  timeTotal: 3600,
  timeRemaining: 3477,
  greenFlagTimestamp: 100,
};

const totalRaceValueResult = {
  isFixedLapRace: true,
  totalRaceLaps: 20,
  totalRaceTime: 2400,
  adjustedRaceTime: 2350,
};

describe('useSessionTimingStoreUpdater', () => {
  beforeEach(() => {
    useSessionTimingStore.setState({
      state: 0,
      currentLap: 0,
      totalLaps: 0,
      time: 0,
      timeTotal: 0,
      timeRemaining: 0,
      greenFlagTimestamp: 0,
      isFixedLapRace: true,
      totalRaceLaps: 0,
      totalRaceTime: 0,
      adjustedRaceTime: 0,
    });
    vi.mocked(useSessionLapCount).mockReturnValue(sessionLapCountResult);
    vi.mocked(useTotalRaceValue).mockReturnValue(totalRaceValueResult);
  });

  it('writes the merged output of useSessionLapCount + useTotalRaceValue into the store when enabled', () => {
    renderHook(() => useSessionTimingStoreUpdater(true));

    expect(useSessionTimingStore.getState()).toMatchObject({
      ...sessionLapCountResult,
      ...totalRaceValueResult,
    });
  });

  it('re-syncs the store when the underlying hook results change', () => {
    const { rerender } = renderHook(() => useSessionTimingStoreUpdater(true));

    vi.mocked(useSessionLapCount).mockReturnValue({
      ...sessionLapCountResult,
      currentLap: 4,
    });
    rerender();

    expect(useSessionTimingStore.getState().currentLap).toBe(4);
  });

  it('does not write to the store when disabled', () => {
    renderHook(() => useSessionTimingStoreUpdater(false));

    expect(useSessionTimingStore.getState()).toMatchObject({
      state: 0,
      currentLap: 0,
      totalLaps: 0,
    });
  });
});
