import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackTemperatureStoreUpdater } from './TrackTemperatureStoreUpdater';
import { useTrackTemperatureStore } from './TrackTemperatureStore';
import { useTelemetry } from '@irdashies/context';

vi.mock('@irdashies/context', async () => {
  const actual = await vi.importActual('@irdashies/context');
  return {
    ...actual,
    useTelemetry: vi.fn(),
  };
});

describe('useTrackTemperatureStoreUpdater', () => {
  beforeEach(() => {
    useTrackTemperatureStore.setState({
      trackTempC: undefined,
      airTempC: undefined,
    });
    vi.mocked(useTelemetry).mockImplementation(((key: string) => {
      if (key === 'TrackTempCrew') return { value: [28] };
      if (key === 'AirTemp') return { value: [22] };
      return undefined;
    }) as typeof useTelemetry);
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
