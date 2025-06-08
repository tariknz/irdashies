import { describe, it, expect, beforeEach } from 'vitest';
import { useCarSpeedsStore } from './CarSpeedsStore';
import type { Telemetry } from '@irdashies/types';

function makeTelemetry(lapDistPct: number[], sessionTime: number): Telemetry {
  return {
    CarIdxLapDistPct: { value: lapDistPct },
    SessionTime: { value: [sessionTime] },
  } as unknown as Telemetry;
}

describe('CarSpeedsStore', () => {
  beforeEach(() => {
    useCarSpeedsStore.setState({
      carSpeedBuffer: null,
      lastSpeedUpdate: 0,
      carSpeeds: [],
    });
  });

  it('should have initial state', () => {
    const state = useCarSpeedsStore.getState();
    expect(state.carSpeeds).toEqual([]);
    expect(state.carSpeedBuffer).toBeNull();
    expect(state.lastSpeedUpdate).toBe(0);
  });

  it('should set carSpeeds to 0 if no telemetry or trackLength', () => {
    useCarSpeedsStore.getState().updateCarSpeeds(null, 1000);
    expect(useCarSpeedsStore.getState().carSpeeds).toEqual([]);
    useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([], 0), 0);
    expect(useCarSpeedsStore.getState().carSpeeds).toEqual([]);
  });

  it('should calculate speed for a single car', () => {
    // First call: sets buffer, no speed yet
    useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([0.1], 1), 1000);
    expect(useCarSpeedsStore.getState().carSpeeds).toEqual([0]);
    // Second call: should calculate speed
    useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([0.2], 2), 1000);
    // (0.2-0.1)*1000 = 100m, (2-1)s = 1s, speed = 100/1*3.6 = 360 km/h
    expect(useCarSpeedsStore.getState().carSpeeds[0]).toBeCloseTo(360, 1);
  });

  it('should handle wrap-around lap distance', () => {
    useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([0.95], 1), 1000);
    useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([0.05], 2), 1000);
    // (0.05+1-0.95)*1000 = 100m, (2-1)s = 1s, speed = 100/1*3.6 = 360 km/h
    expect(useCarSpeedsStore.getState().carSpeeds[0]).toBeCloseTo(360, 1);
  });

  it('should maintain a moving average window', () => {
    // Fill up the window
    let pct = 0.0;
    for (let i = 1; i <= 6; i++) {
      useCarSpeedsStore.getState().updateCarSpeeds(makeTelemetry([pct], i), 1000);
      pct += 0.1;
    }
    // The speedHistory should only keep 5 samples
    const buffer = useCarSpeedsStore.getState().carSpeedBuffer;
    expect(buffer?.speedHistory[0].length).toBeLessThanOrEqual(5);
  });
}); 