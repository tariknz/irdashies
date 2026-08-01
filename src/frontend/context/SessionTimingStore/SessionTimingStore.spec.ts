import { describe, expect, it, beforeEach } from 'vitest';
import { useSessionTimingStore } from './SessionTimingStore';

describe('SessionTimingStore', () => {
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
  });

  it('has defaults matching useSessionLapCount/useTotalRaceValue before telemetry arrives', () => {
    const state = useSessionTimingStore.getState();
    expect(state.state).toBe(0);
    expect(state.currentLap).toBe(0);
    expect(state.totalLaps).toBe(0);
    expect(state.time).toBe(0);
    expect(state.timeTotal).toBe(0);
    expect(state.timeRemaining).toBe(0);
    expect(state.greenFlagTimestamp).toBe(0);
    // useTotalRaceValue: !((0 > 0) && (0 !== 604800)) === true
    expect(state.isFixedLapRace).toBe(true);
    expect(state.totalRaceLaps).toBe(0);
    expect(state.totalRaceTime).toBe(0);
    expect(state.adjustedRaceTime).toBe(0);
  });

  it('update() replaces every field with the provided values', () => {
    useSessionTimingStore.getState().update({
      state: 4,
      currentLap: 3,
      totalLaps: 20,
      time: 123,
      timeTotal: 3600,
      timeRemaining: 3477,
      greenFlagTimestamp: 100,
      isFixedLapRace: true,
      totalRaceLaps: 20,
      totalRaceTime: 2400,
      adjustedRaceTime: 2350,
    });

    expect(useSessionTimingStore.getState()).toMatchObject({
      state: 4,
      currentLap: 3,
      totalLaps: 20,
      time: 123,
      timeTotal: 3600,
      timeRemaining: 3477,
      greenFlagTimestamp: 100,
      isFixedLapRace: true,
      totalRaceLaps: 20,
      totalRaceTime: 2400,
      adjustedRaceTime: 2350,
    });
  });
});
