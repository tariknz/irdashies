import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayCompare } from '../TelemetryStore/telemetryCompare';
import { SessionState } from '@irdashies/types';

interface PitLapState {
  sessionUniqId: number;
  pitLaps: number[]; // [carIdx]
  carLaps: number[]; // [carIdx]
  actualCarTrackSurface: number[]
  prevCarTrackSurface: number[] // [carIdx],
  sessionTime: number;
  sessionState: number;
  pitEntryTime: (number | null)[]; // [carIdx]
  pitExitTime: (number | null)[]; // [carIdx]
  prevOnPitRoad: boolean[]; // [carIdx]
  entryLap: number[]; // [carIdx]
  updatePitLaps: (
    carIdxOnPitRoad: boolean[],
    carIdxLap: number[],
    currentSessionUniqId: number,
    currentSessionTime: number,
    carIdxTrackSurface: number[],
    sessionState: number
  ) => void;
  reset: () => void;
}

export const usePitLapStore = create<PitLapState>((set, get) => ({
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
  updatePitLaps: (carIdxOnPitRoad, carIdxLap, currentSessionUniqId, currentSessionTime, carIdxTrackSurface, sessionState) => {
    const { sessionUniqId, pitLaps, sessionTime, prevCarTrackSurface, actualCarTrackSurface, pitEntryTime, pitExitTime, prevOnPitRoad, entryLap } = get();

    // reset store when session was changed
    if ((sessionUniqId !== 0 && currentSessionUniqId !== sessionUniqId) || sessionTime > currentSessionTime) {
      set({ sessionUniqId: currentSessionUniqId,
            pitLaps: [],
            carLaps: [],
            actualCarTrackSurface: [],
            prevCarTrackSurface: [],
            pitEntryTime: [],
            pitExitTime: [],
            prevOnPitRoad: [],
            entryLap: [],
            sessionTime: currentSessionTime,
            sessionState: sessionState
      })
      return
    }

    const updatedPitEntryTime = [...pitEntryTime];
    const updatedPitExitTime = [...pitExitTime];
    const updatedPrevOnPitRoad = [...prevOnPitRoad];
    const updatedEntryLap = [...entryLap];

    carIdxOnPitRoad.forEach((onPitRoad, idx) => {
      const wasOnPitRoad = updatedPrevOnPitRoad[idx] ?? false;
      const trackSurface = carIdxTrackSurface[idx] ?? -1;
      const currentLap = carIdxLap[idx] ?? -1;
      const lastEntryLap = updatedEntryLap[idx] ?? -1;

      if (onPitRoad) {
        pitLaps[idx] = currentLap;
      }

      if (!wasOnPitRoad && onPitRoad) {
        const isRacing = sessionState === SessionState.Racing;
        const isOnPitRoadSurface = trackSurface >= 0 && trackSurface < 3;
        const lapChanged = currentLap > 0 && currentLap !== lastEntryLap;

        if (isRacing && isOnPitRoadSurface && lapChanged) {
          updatedPitEntryTime[idx] = currentSessionTime;
          updatedPitExitTime[idx] = null;
          updatedEntryLap[idx] = currentLap;
        }
      }

      if (wasOnPitRoad && !onPitRoad) {
        const hasExitedPitRoad = trackSurface > 1;
        const isSessionActive = sessionState < SessionState.Checkered;

        if (hasExitedPitRoad && isSessionActive) {
          updatedPitExitTime[idx] = currentSessionTime;
        }
      }

      if (sessionState >= SessionState.Checkered && updatedPitEntryTime[idx] !== null && updatedPitExitTime[idx] === null) {
        updatedPitEntryTime[idx] = null;
      }

      updatedPrevOnPitRoad[idx] = onPitRoad;
    });

    carIdxTrackSurface.forEach((location, idx) => {
      if (actualCarTrackSurface[idx] !== location && sessionState < SessionState.Checkered && location != -1) {
        prevCarTrackSurface[idx] = actualCarTrackSurface[idx];
        actualCarTrackSurface[idx] = location;
      }
    });

    set({
      pitLaps: pitLaps,
      carLaps: carIdxLap,
      prevCarTrackSurface: prevCarTrackSurface,
      actualCarTrackSurface: actualCarTrackSurface,
      pitEntryTime: updatedPitEntryTime,
      pitExitTime: updatedPitExitTime,
      prevOnPitRoad: updatedPrevOnPitRoad,
      entryLap: updatedEntryLap,
      sessionTime: currentSessionTime,
      sessionState: sessionState,
      sessionUniqId: currentSessionUniqId
    });
  },
  reset: () => {
    set({
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
    });
  },
}));

function calculatePitStopDuration(
  entryTime: number | null | undefined,
  exitTime: number | null | undefined,
  currentSessionTime: number,
  sessionState: number
): number | null {
  if (entryTime == null) {
    return null;
  }

  const entry = Math.round(entryTime);
  const exit = exitTime != null ? Math.round(exitTime) : Math.round(currentSessionTime);
  const duration = Math.max(exit, entry) - entry;

  const isSessionEnded = sessionState >= SessionState.Checkered;
  const hasInvalidDuration = duration <= 0 || isNaN(duration) || duration > 300;
  const isIncompletePitStop = isSessionEnded && exitTime == null;

  if (hasInvalidDuration || isIncompletePitStop) {
    return null;
  }

  return duration;
}

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const usePitLap = (): number[] => useStoreWithEqualityFn(usePitLapStore, (state) => state.pitLaps, arrayCompare);
export const useCarLap = (): number[] => useStoreWithEqualityFn(usePitLapStore, (state) => state.carLaps, arrayCompare);
export const usePrevCarTrackSurface = (): number[] => useStoreWithEqualityFn(usePitLapStore, (state) => state.prevCarTrackSurface, arrayCompare);

/**
 * @returns An array of pit stop durations in seconds for each car by index. Returns null for cars not in pit or with invalid durations.
 */
export const usePitStopDuration = (): (number | null)[] => {
  return useStoreWithEqualityFn(
    usePitLapStore,
    (state) => {
      const durations: (number | null)[] = [];
      const maxCarIdx = Math.max(
        state.pitEntryTime.length,
        state.pitExitTime.length,
        state.carLaps.length
      );

      for (let idx = 0; idx < maxCarIdx; idx++) {
        durations[idx] = calculatePitStopDuration(
          state.pitEntryTime[idx],
          state.pitExitTime[idx],
          state.sessionTime,
          state.sessionState
        );
      }

      return durations;
    },
    arrayCompare
  );
};