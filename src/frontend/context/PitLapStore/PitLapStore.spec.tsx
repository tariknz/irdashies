import { describe, it, expect, beforeEach } from 'vitest';
import { usePitLapStore } from './PitLapStore';

describe('PitLapStore', () => {
  beforeEach(() => {
    usePitLapStore.setState({
      sessionUniqId: 0,
      sessionTime: 0,
      pitLaps: [],
      carLaps: [],
      prevCarTrackSurface: [],
      actualCarTrackSurface: [],
    });
  });

  it('should have initial state', () => {
    const state = usePitLapStore.getState();
    expect(state.pitLaps).toEqual([]);
    expect(state.carLaps).toEqual([]);
    expect(state.sessionUniqId).toBe(0);
    expect(state.sessionTime).toBe(0);
    expect(state.prevCarTrackSurface).toEqual([]);
    expect(state.actualCarTrackSurface).toEqual([]);
  });

  it('should update pit laps when car enters pit road', () => {
    const carIdxOnPitRoad = [0, 1, 0, 1];
    const carIdxLap = [5, 10, 15, 20];
    const sessionUniqId = 123;
    const sessionTime = 100.5;
    const carIdxTrackSurface = [0, 0, 0, 0];
    const sessionState = 4;

    usePitLapStore.getState().updatePitLaps(
      carIdxOnPitRoad,
      carIdxLap,
      sessionUniqId,
      sessionTime,
      carIdxTrackSurface,
      sessionState
    );

    const state = usePitLapStore.getState();
    expect(state.pitLaps[1]).toBe(10);
    expect(state.pitLaps[3]).toBe(20);
    expect(state.carLaps).toEqual(carIdxLap);
    expect(state.sessionUniqId).toBe(sessionUniqId);
    expect(state.sessionTime).toBe(sessionTime);
  });

  it('should reset store when session changes', () => {
    usePitLapStore.setState({
      sessionUniqId: 100,
      sessionTime: 50,
      pitLaps: [1, 2, 3],
      carLaps: [5, 6, 7],
      prevCarTrackSurface: [0, 1, 2],
      actualCarTrackSurface: [1, 2, 3],
    });

    const newSessionUniqId = 200;
    const newSessionTime = 0;

    usePitLapStore.getState().updatePitLaps(
      [0, 0, 0],
      [0, 0, 0],
      newSessionUniqId,
      newSessionTime,
      [0, 0, 0],
      4
    );

    const state = usePitLapStore.getState();
    expect(state.sessionUniqId).toBe(newSessionUniqId);
    expect(state.sessionTime).toBe(newSessionTime);
    expect(state.pitLaps).toEqual([]);
    expect(state.carLaps).toEqual([]);
    expect(state.prevCarTrackSurface).toEqual([]);
    expect(state.actualCarTrackSurface).toEqual([]);
  });

  it('should reset store when session time goes backwards', () => {
    usePitLapStore.setState({
      sessionUniqId: 100,
      sessionTime: 50,
      pitLaps: [1, 2, 3],
      carLaps: [5, 6, 7],
      prevCarTrackSurface: [0, 1, 2],
      actualCarTrackSurface: [1, 2, 3],
    });

    usePitLapStore.getState().updatePitLaps(
      [0, 0, 0],
      [0, 0, 0],
      100,
      25,
      [0, 0, 0],
      4
    );

    const state = usePitLapStore.getState();
    expect(state.pitLaps).toEqual([]);
    expect(state.carLaps).toEqual([]);
  });

  it('should track car track surface changes', () => {
    const carIdxOnPitRoad = [0, 0];
    const carIdxLap = [1, 1];
    const sessionUniqId = 123;
    const sessionTime = 100;
    const carIdxTrackSurface = [0, 1];
    const sessionState = 4;

    usePitLapStore.getState().updatePitLaps(
      carIdxOnPitRoad,
      carIdxLap,
      sessionUniqId,
      sessionTime,
      carIdxTrackSurface,
      sessionState
    );

    let state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface).toEqual([0, 1]);
    expect(state.prevCarTrackSurface).toEqual([undefined, undefined]);

    usePitLapStore.getState().updatePitLaps(
      carIdxOnPitRoad,
      carIdxLap,
      sessionUniqId,
      sessionTime + 1,
      [2, 3],
      sessionState
    );

    state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface).toEqual([2, 3]);
    expect(state.prevCarTrackSurface).toEqual([0, 1]);
  });

  it('should not update track surface when sessionState is >= 5', () => {
    usePitLapStore.setState({
      actualCarTrackSurface: [0, 0],
      prevCarTrackSurface: [0, 0],
    });

    usePitLapStore.getState().updatePitLaps(
      [0, 0],
      [1, 1],
      123,
      100,
      [1, 1],
      5
    );

    const state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface).toEqual([0, 0]);
    expect(state.prevCarTrackSurface).toEqual([0, 0]);
  });

  it('should not update track surface when location is -1', () => {
    usePitLapStore.setState({
      actualCarTrackSurface: [0, 0],
      prevCarTrackSurface: [0, 0],
    });

    usePitLapStore.getState().updatePitLaps(
      [0, 0],
      [1, 1],
      123,
      100,
      [-1, 1],
      4
    );

    const state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface[0]).toBe(0);
    expect(state.actualCarTrackSurface[1]).toBe(1);
  });
});
