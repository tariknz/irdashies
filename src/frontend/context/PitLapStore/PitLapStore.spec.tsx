import { describe, it, expect, beforeEach } from 'vitest';
import { usePitLapStore } from './PitLapStore';
import type { Telemetry } from '@irdashies/types';

function makeTelemetry(pitLaps: number[], sessionTime: number): Telemetry {
  return {
    CarIdxLastLapTime: { value: pitLaps },
    SessionTime: { value: [sessionTime] },
  } as unknown as Telemetry;
}

describe('LapTimesStore', () => {
  beforeEach(() => {
    usePitLapStore.setState({
      pitLaps: [],
    });
  });

  it('should have initial state', () => {
    const state = usePitLapStore.getState();
    expect(state.pitLaps).toEqual([]);
  });

  it('should set pitLaps to 0 if no telemetry', () => {
    usePitLapStore.getState().updatePitLaps(null);
    expect(usePitLapStore.getState().pitLaps).toEqual([]);
    usePitLapStore.getState().updatePitLaps(makeTelemetry([], 0));
    expect(usePitLapStore.getState().pitLaps).toEqual([]);
  });
});
