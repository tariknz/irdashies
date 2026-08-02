import { describe, expect, it, beforeEach } from 'vitest';
import { useTrackTemperatureStore } from './TrackTemperatureStore';

describe('TrackTemperatureStore', () => {
  beforeEach(() => {
    useTrackTemperatureStore.setState({
      trackTempC: undefined,
      airTempC: undefined,
    });
  });

  it('has undefined defaults before telemetry arrives', () => {
    const state = useTrackTemperatureStore.getState();
    expect(state.trackTempC).toBeUndefined();
    expect(state.airTempC).toBeUndefined();
  });

  it('update() sets both raw Celsius values', () => {
    useTrackTemperatureStore.getState().update(28, 22);

    expect(useTrackTemperatureStore.getState()).toMatchObject({
      trackTempC: 28,
      airTempC: 22,
    });
  });
});
