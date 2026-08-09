import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackTemperatureStoreUpdater } from './TrackTemperatureStoreUpdater';
import { useTrackTemperatureStore } from './TrackTemperatureStore';
import { useSessionBarSnapshot } from '../ChannelStore';

vi.mock('../ChannelStore', () => {
  return { useSessionBarSnapshot: vi.fn() };
});

describe('useTrackTemperatureStoreUpdater', () => {
  beforeEach(() => {
    useTrackTemperatureStore.setState({
      trackTempC: undefined,
      airTempC: undefined,
    });
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      trackTemp: 28,
      airTemp: 22,
    } as ReturnType<typeof useSessionBarSnapshot>);
  });

  it('writes raw Celsius values into the store when enabled', () => {
    renderHook(() => useTrackTemperatureStoreUpdater(true));

    expect(useTrackTemperatureStore.getState()).toMatchObject({
      trackTempC: 28,
      airTempC: 22,
    });
  });

  it('does not write to the store when disabled', () => {
    renderHook(() => useTrackTemperatureStoreUpdater(false));

    expect(useTrackTemperatureStore.getState()).toMatchObject({
      trackTempC: undefined,
      airTempC: undefined,
    });
  });
});
