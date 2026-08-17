import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePitLapStore, usePitStopDuration } from './PitLapStore';
import { SessionState, TrackLocation } from '@irdashies/types';

describe('PitLapStore', () => {
  beforeEach(() => {
    usePitLapStore.setState({
      sessionUniqId: 0,
      sessionTime: 0,
      sessionState: 0,
      pitLaps: [],
      carLaps: [],
      prevCarTrackSurface: [],
      actualCarTrackSurface: [],
      pitEntryTime: [],
      pitExitTime: [],
      prevOnPitRoad: [],
      entryLap: [],
      firstObservedLap: [],
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
    const carIdxOnPitRoad = [false, true, false, true];
    const carIdxLap = [5, 10, 15, 20];
    const sessionUniqId = 123;
    const sessionTime = 100.5;
    const carIdxTrackSurface = [0, 0, 0, 0];
    const sessionState = 4;

    usePitLapStore
      .getState()
      .updatePitLaps(
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

  it('should record the lap each car was first observed on', () => {
    usePitLapStore
      .getState()
      .updatePitLaps(
        [false, false, false],
        [0, 14, -1],
        123,
        100,
        [3, 3, -1],
        SessionState.Racing
      );

    const state = usePitLapStore.getState();
    expect(state.firstObservedLap[0]).toBe(0);
    expect(state.firstObservedLap[1]).toBe(14);
    // Car not in the world (lap -1) is not recorded yet
    expect(state.firstObservedLap[2]).toBeUndefined();
  });

  it('should not overwrite the first observed lap on later updates', () => {
    usePitLapStore
      .getState()
      .updatePitLaps([false], [3], 123, 100, [3], SessionState.Racing);
    usePitLapStore
      .getState()
      .updatePitLaps([false], [8], 123, 110, [3], SessionState.Racing);

    expect(usePitLapStore.getState().firstObservedLap[0]).toBe(3);
  });

  it('should reset first observed lap when session changes', () => {
    usePitLapStore.setState({
      sessionUniqId: 100,
      sessionTime: 50,
      firstObservedLap: [1, 2, 3],
    });

    usePitLapStore
      .getState()
      .updatePitLaps([false], [0], 200, 0, [0], SessionState.Racing);

    expect(usePitLapStore.getState().firstObservedLap).toEqual([]);
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

    usePitLapStore
      .getState()
      .updatePitLaps(
        [false, false, false],
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

    usePitLapStore
      .getState()
      .updatePitLaps([false, false, false], [0, 0, 0], 100, 25, [0, 0, 0], 4);

    const state = usePitLapStore.getState();
    expect(state.pitLaps).toEqual([]);
    expect(state.carLaps).toEqual([]);
  });

  it('should track car track surface changes', () => {
    const carIdxOnPitRoad = [false, false];
    const carIdxLap = [1, 1];
    const sessionUniqId = 123;
    const sessionTime = 100;
    const carIdxTrackSurface = [0, 1];
    const sessionState = 4;

    usePitLapStore
      .getState()
      .updatePitLaps(
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

    usePitLapStore
      .getState()
      .updatePitLaps(
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

    usePitLapStore
      .getState()
      .updatePitLaps([false, false], [1, 1], 123, 100, [1, 1], 5);

    const state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface).toEqual([0, 0]);
    expect(state.prevCarTrackSurface).toEqual([0, 0]);
  });

  it('should not update track surface when location is -1', () => {
    usePitLapStore.setState({
      actualCarTrackSurface: [0, 0],
      prevCarTrackSurface: [0, 0],
    });

    usePitLapStore
      .getState()
      .updatePitLaps([false, false], [1, 1], 123, 100, [-1, 1], 4);

    const state = usePitLapStore.getState();
    expect(state.actualCarTrackSurface[0]).toBe(0);
    expect(state.actualCarTrackSurface[1]).toBe(1);
  });

  describe('pit time calculation', () => {
    it('should set pit entry time when car enters pit road', () => {
      const sessionUniqId = 123;
      const entryTime = 100.5;
      const carIdxLap = [5, 5];
      const carIdxTrackSurface = [2, 0];
      const sessionState = SessionState.Racing;

      usePitLapStore
        .getState()
        .updatePitLaps(
          [false, true],
          carIdxLap,
          sessionUniqId,
          entryTime,
          carIdxTrackSurface,
          sessionState
        );

      const state = usePitLapStore.getState();
      expect(state.pitEntryTime[1]).toBe(entryTime);
      expect(state.pitExitTime[1]).toBeNull();
      expect(state.entryLap[1]).toBe(5);
    });

    it('should set pit exit time when car exits pit road', () => {
      const sessionUniqId = 123;
      const entryTime = 100.5;
      const exitTime = 125.7;
      const carIdxLap = [5, 5];
      const sessionState = SessionState.Racing;

      usePitLapStore.setState({
        sessionUniqId,
        sessionTime: entryTime,
        sessionState,
        prevOnPitRoad: [false, true],
        pitEntryTime: [null, entryTime],
        pitExitTime: [null, null],
        entryLap: [0, 5],
      });

      usePitLapStore
        .getState()
        .updatePitLaps(
          [false, false],
          carIdxLap,
          sessionUniqId,
          exitTime,
          [0, 2],
          sessionState
        );

      const state = usePitLapStore.getState();
      expect(state.pitEntryTime[1]).toBe(entryTime);
      expect(state.pitExitTime[1]).toBe(exitTime);
    });

    it('should calculate pit stop duration from entry and exit times', () => {
      const entryTime = 100.5;
      const exitTime = 125.7;
      const sessionTime = 130;

      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime,
        sessionState: SessionState.Racing,
        pitEntryTime: [entryTime],
        pitExitTime: [exitTime],
      });

      const { result } = renderHook(() => usePitStopDuration());
      const state = usePitLapStore.getState();

      expect(result.current[0]).toBe(25);
      expect(state.pitEntryTime[0]).toBe(entryTime);
      expect(state.pitExitTime[0]).toBe(exitTime);
    });

    it('should calculate ongoing pit stop duration using current session time', () => {
      const entryTime = 100.5;
      const currentSessionTime = 125.7;

      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: currentSessionTime,
        sessionState: SessionState.Racing,
        pitEntryTime: [entryTime],
        pitExitTime: [null],
      });

      const { result } = renderHook(() => usePitStopDuration());
      const state = usePitLapStore.getState();

      expect(result.current[0]).toBe(25);
      expect(state.pitEntryTime[0]).toBe(entryTime);
      expect(state.pitExitTime[0]).toBeNull();
    });

    it('should clear pit entry time when session ends with incomplete pit stop', () => {
      const entryTime = 100.5;

      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 125,
        sessionState: SessionState.Checkered,
        prevOnPitRoad: [false, true],
        pitEntryTime: [null, entryTime],
        pitExitTime: [null, null],
      });

      usePitLapStore
        .getState()
        .updatePitLaps(
          [false, true],
          [1, 1],
          123,
          125,
          [0, 0],
          SessionState.Checkered
        );

      const state = usePitLapStore.getState();
      expect(state.pitEntryTime[1]).toBeNull();
    });

    it('should track multiple cars pit entry and exit times', () => {
      const sessionUniqId = 123;
      const entryTime1 = 100.5;
      const entryTime2 = 150.3;
      const exitTime1 = 125.7;
      const sessionState = SessionState.Racing;

      usePitLapStore.setState({
        sessionUniqId,
        sessionTime: entryTime1,
        sessionState,
        prevOnPitRoad: [false, false],
        pitEntryTime: [],
        pitExitTime: [],
        entryLap: [],
      });

      usePitLapStore
        .getState()
        .updatePitLaps(
          [true, true],
          [5, 6],
          sessionUniqId,
          entryTime1,
          [2, 2],
          sessionState
        );

      let state = usePitLapStore.getState();
      expect(state.pitEntryTime[0]).toBe(entryTime1);
      expect(state.pitEntryTime[1]).toBe(entryTime1);

      usePitLapStore.setState({
        prevOnPitRoad: [true, false],
        sessionTime: entryTime2,
      });

      usePitLapStore
        .getState()
        .updatePitLaps(
          [true, true],
          [5, 7],
          sessionUniqId,
          entryTime2,
          [2, 2],
          sessionState
        );

      state = usePitLapStore.getState();
      expect(state.pitEntryTime[1]).toBe(entryTime2);

      usePitLapStore.setState({
        prevOnPitRoad: [true, true],
        sessionTime: exitTime1,
      });

      usePitLapStore
        .getState()
        .updatePitLaps(
          [false, true],
          [5, 7],
          sessionUniqId,
          exitTime1,
          [2, 2],
          sessionState
        );

      state = usePitLapStore.getState();
      expect(state.pitExitTime[0]).toBe(exitTime1);
      expect(state.pitEntryTime[0]).toBe(entryTime1);
    });

    it('should return null when entry time is null', () => {
      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 130,
        sessionState: SessionState.Racing,
        pitEntryTime: [null],
        pitExitTime: [125],
      });

      const { result } = renderHook(() => usePitStopDuration());
      expect(result.current[0]).toBeNull();
    });

    it('should return null for invalid duration (exit before entry)', () => {
      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 130,
        sessionState: SessionState.Racing,
        pitEntryTime: [125],
        pitExitTime: [100],
      });

      const { result } = renderHook(() => usePitStopDuration());
      expect(result.current[0]).toBeNull();
    });

    it('should return null for duration greater than 300 seconds', () => {
      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 410,
        sessionState: SessionState.Racing,
        pitEntryTime: [100],
        pitExitTime: [401],
      });

      const { result } = renderHook(() => usePitStopDuration());
      expect(result.current[0]).toBeNull();
    });

    it('should return null for incomplete pit stop when session ended', () => {
      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 125,
        sessionState: SessionState.Checkered,
        pitEntryTime: [100],
        pitExitTime: [null],
      });

      const { result } = renderHook(() => usePitStopDuration());
      expect(result.current[0]).toBeNull();
    });

    it('should calculate duration for complete pit stop even when session ended', () => {
      usePitLapStore.setState({
        sessionUniqId: 123,
        sessionTime: 130,
        sessionState: SessionState.Checkered,
        pitEntryTime: [100],
        pitExitTime: [125],
      });

      const { result } = renderHook(() => usePitStopDuration());
      expect(result.current[0]).toBe(25);
    });
  });

  describe('team race driver swaps', () => {
    const SESSION = 123;
    const CAR = 1;

    interface Frame {
      t: number;
      onPitRoad: boolean;
      surface: number;
      lap: number;
    }

    // Feeds a stop frame by frame for a single car and returns its measured
    // duration. Car 0 is an inert on-track filler so the arrays are realistic.
    const playStop = (frames: Frame[]) => {
      usePitLapStore.setState({ sessionUniqId: SESSION });

      for (const frame of frames) {
        usePitLapStore
          .getState()
          .updatePitLaps(
            [false, frame.onPitRoad],
            [0, frame.lap],
            SESSION,
            frame.t,
            [TrackLocation.OnTrack, frame.surface],
            SessionState.Racing
          );
      }

      const { pitEntryTime, pitExitTime } = usePitLapStore.getState();
      return {
        entry: pitEntryTime[CAR] ?? null,
        exit: pitExitTime[CAR] ?? null,
      };
    };

    // A 124s stop on lap 10, with the driver change at t=140..142. iRacing drops
    // the car out of the world while the new driver takes over, which reads as
    // CarIdxOnPitRoad true -> false -> true.
    const swapStop = (lapInStall: number): Frame[] => [
      { t: 100, onPitRoad: false, surface: TrackLocation.OnTrack, lap: 10 },
      {
        t: 101,
        onPitRoad: true,
        surface: TrackLocation.ApproachingPits,
        lap: 10,
      },
      {
        t: 105,
        onPitRoad: true,
        surface: TrackLocation.InPitStall,
        lap: lapInStall,
      },
      { t: 140, onPitRoad: false, surface: TrackLocation.NotInWorld, lap: -1 },
      {
        t: 142,
        onPitRoad: true,
        surface: TrackLocation.InPitStall,
        lap: lapInStall,
      },
      {
        t: 220,
        onPitRoad: true,
        surface: TrackLocation.ApproachingPits,
        lap: lapInStall,
      },
      {
        t: 225,
        onPitRoad: false,
        surface: TrackLocation.OnTrack,
        lap: lapInStall,
      },
    ];

    it('times the whole stop across a driver change', () => {
      const { entry, exit } = playStop(swapStop(10));

      expect(entry).toBe(101);
      expect(exit).toBe(225);
      expect((exit ?? 0) - (entry ?? 0)).toBe(124);
    });

    it('times the whole stop when the lap ticks over during the stop', () => {
      // Pit lane spans the start/finish line, so the car's lap number changes
      // between crossing the pit entry line and reaching its stall. This used to
      // let the driver change re-arm the entry, reporting 83s instead of 124s.
      const { entry, exit } = playStop(swapStop(11));

      expect(entry).toBe(101);
      expect(exit).toBe(225);
      expect((exit ?? 0) - (entry ?? 0)).toBe(124);
    });

    it('does not close the stop while the car is out of the world', () => {
      const frames = swapStop(10);
      const upToSwap = frames.slice(0, 4); // through the NotInWorld frame

      const { entry, exit } = playStop(upToSwap);

      expect(entry).toBe(101);
      expect(exit).toBeNull();
    });

    it('reports an ongoing duration that keeps counting through the swap', () => {
      playStop(swapStop(10).slice(0, 5)); // through the new driver taking over
      usePitLapStore.setState({ sessionTime: 150 });

      const { result } = renderHook(() => usePitStopDuration());

      // 150 - 101, not 150 - 142.
      expect(result.current[CAR]).toBe(49);
    });

    it('still records a normal stop with no driver change', () => {
      const { entry, exit } = playStop([
        { t: 100, onPitRoad: false, surface: TrackLocation.OnTrack, lap: 10 },
        {
          t: 101,
          onPitRoad: true,
          surface: TrackLocation.ApproachingPits,
          lap: 10,
        },
        { t: 105, onPitRoad: true, surface: TrackLocation.InPitStall, lap: 10 },
        { t: 130, onPitRoad: false, surface: TrackLocation.OnTrack, lap: 10 },
      ]);

      expect(entry).toBe(101);
      expect(exit).toBe(130);
    });

    it('starts a fresh stop on a later lap after the swap stop closed', () => {
      playStop(swapStop(10));

      usePitLapStore
        .getState()
        .updatePitLaps(
          [false, true],
          [0, 25],
          SESSION,
          800,
          [TrackLocation.OnTrack, TrackLocation.ApproachingPits],
          SessionState.Racing
        );

      const state = usePitLapStore.getState();
      expect(state.pitEntryTime[CAR]).toBe(800);
      expect(state.pitExitTime[CAR]).toBeNull();
    });
  });
});
