import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayCompare } from '../TelemetryStore/telemetryCompare';
import { SessionState } from '@irdashies/types';

interface PitLapState {
  sessionUniqId: number;
  pitLaps: number[]; // [carIdx]
  carLaps: number[]; // [carIdx]
  actualCarTrackSurface: number[];
  prevCarTrackSurface: number[]; // [carIdx],
  sessionTime: number;
  sessionState: number;
  pitEntryTime: (number | null)[]; // [carIdx]
  pitExitTime: (number | null)[]; // [carIdx]
  prevOnPitRoad: boolean[]; // [carIdx]
  entryLap: number[]; // [carIdx]
  firstObservedLap: number[]; // [carIdx] — CarIdxLap when this car was first seen
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
  firstObservedLap: [],
  updatePitLaps: (
    carIdxOnPitRoad,
    carIdxLap,
    currentSessionUniqId,
    currentSessionTime,
    carIdxTrackSurface,
    sessionState
  ) => {
    const {
      sessionUniqId,
      pitLaps,
      sessionTime,
      prevCarTrackSurface,
      actualCarTrackSurface,
      pitEntryTime,
      pitExitTime,
      prevOnPitRoad,
      entryLap,
      firstObservedLap,
    } = get();

    // reset store when session was changed
    if (
      (sessionUniqId !== 0 && currentSessionUniqId !== sessionUniqId) ||
      sessionTime > currentSessionTime
    ) {
      set({
        sessionUniqId: currentSessionUniqId,
        pitLaps: [],
        carLaps: [],
        actualCarTrackSurface: [],
        prevCarTrackSurface: [],
        pitEntryTime: [],
        pitExitTime: [],
        prevOnPitRoad: [],
        entryLap: [],
        firstObservedLap: [],
        sessionTime: currentSessionTime,
        sessionState: sessionState,
      });
      return;
    }

    // Defer cloning — only create new arrays when we actually need to mutate them.
    // This avoids 4× per-tick allocations of 64-element arrays when nothing changed.
    let updatedPitEntryTime: (number | null)[] | null = null;
    let updatedPitExitTime: (number | null)[] | null = null;
    let updatedPrevOnPitRoad: boolean[] | null = null;
    let updatedEntryLap: number[] | null = null;
    let updatedFirstObservedLap: number[] | null = null;
    let pitLapsChanged = false;

    carIdxOnPitRoad.forEach((onPitRoad, idx) => {
      const wasOnPitRoad = prevOnPitRoad[idx] ?? false;
      const trackSurface = carIdxTrackSurface[idx] ?? -1;
      const currentLap = carIdxLap[idx] ?? -1;
      const lastEntryLap = entryLap[idx] ?? -1;

      // Record the lap on which we first observed each car. Used to tell whether
      // we've watched a car since its session start — if so, its first-stint lap
      // equals the total session lap even without an observed pit stop.
      if (firstObservedLap[idx] === undefined && currentLap >= 0) {
        if (!updatedFirstObservedLap)
          updatedFirstObservedLap = [...firstObservedLap];
        updatedFirstObservedLap[idx] = currentLap;
      }

      if (onPitRoad && pitLaps[idx] !== currentLap) {
        pitLaps[idx] = currentLap;
        pitLapsChanged = true;
      }

      if (!wasOnPitRoad && onPitRoad) {
        const isRacing = sessionState === SessionState.Racing;
        const isOnPitRoadSurface = trackSurface >= 0 && trackSurface < 3;
        const lapChanged = currentLap > 0 && currentLap !== lastEntryLap;

        if (isRacing && isOnPitRoadSurface && lapChanged) {
          if (!updatedPitEntryTime) updatedPitEntryTime = [...pitEntryTime];
          if (!updatedPitExitTime) updatedPitExitTime = [...pitExitTime];
          if (!updatedEntryLap) updatedEntryLap = [...entryLap];
          updatedPitEntryTime[idx] = currentSessionTime;
          updatedPitExitTime[idx] = null;
          updatedEntryLap[idx] = currentLap;
        }
      }

      if (wasOnPitRoad && !onPitRoad) {
        const hasExitedPitRoad = trackSurface > 1;
        const isSessionActive = sessionState < SessionState.Checkered;

        if (hasExitedPitRoad && isSessionActive) {
          if (!updatedPitExitTime) updatedPitExitTime = [...pitExitTime];
          updatedPitExitTime[idx] = currentSessionTime;
        }
      }

      const currentEntryTime = (updatedPitEntryTime ?? pitEntryTime)[idx];
      const currentExitTime = (updatedPitExitTime ?? pitExitTime)[idx];
      if (
        sessionState >= SessionState.Checkered &&
        currentEntryTime !== null &&
        currentExitTime === null
      ) {
        if (!updatedPitEntryTime) updatedPitEntryTime = [...pitEntryTime];
        updatedPitEntryTime[idx] = null;
      }

      if (prevOnPitRoad[idx] !== onPitRoad) {
        if (!updatedPrevOnPitRoad) updatedPrevOnPitRoad = [...prevOnPitRoad];
        updatedPrevOnPitRoad[idx] = onPitRoad;
      }
    });

    // Clone track-surface arrays only when at least one slot actually changes.
    // Previously these were mutated in place then re-set with the same reference,
    // which prevented arrayCompare-based subscribers from detecting changes.
    let updatedPrevCarTrackSurface: number[] | null = null;
    let updatedActualCarTrackSurface: number[] | null = null;
    carIdxTrackSurface.forEach((location, idx) => {
      if (
        actualCarTrackSurface[idx] !== location &&
        sessionState < SessionState.Checkered &&
        location != -1
      ) {
        if (!updatedPrevCarTrackSurface)
          updatedPrevCarTrackSurface = [...prevCarTrackSurface];
        if (!updatedActualCarTrackSurface)
          updatedActualCarTrackSurface = [...actualCarTrackSurface];
        updatedPrevCarTrackSurface[idx] = actualCarTrackSurface[idx];
        updatedActualCarTrackSurface[idx] = location;
      }
    });

    const prevState = get();
    const carLapsChanged = carIdxLap !== prevState.carLaps;
    const sessionTimeChanged = sessionTime !== currentSessionTime;
    const sessionStateChanged = prevState.sessionState !== sessionState;
    const sessionUniqIdChanged = sessionUniqId !== currentSessionUniqId;

    const anythingChanged =
      pitLapsChanged ||
      updatedPitEntryTime !== null ||
      updatedPitExitTime !== null ||
      updatedPrevOnPitRoad !== null ||
      updatedEntryLap !== null ||
      updatedFirstObservedLap !== null ||
      updatedPrevCarTrackSurface !== null ||
      updatedActualCarTrackSurface !== null ||
      carLapsChanged ||
      sessionTimeChanged ||
      sessionStateChanged ||
      sessionUniqIdChanged;

    if (!anythingChanged) return;

    set({
      // pitLaps is mutated in place above when a car is on pit road; create a new
      // reference so subscribers using arrayCompare can detect the change.
      pitLaps: pitLapsChanged ? [...pitLaps] : pitLaps,
      carLaps: carIdxLap,
      prevCarTrackSurface: updatedPrevCarTrackSurface ?? prevCarTrackSurface,
      actualCarTrackSurface:
        updatedActualCarTrackSurface ?? actualCarTrackSurface,
      pitEntryTime: updatedPitEntryTime ?? pitEntryTime,
      pitExitTime: updatedPitExitTime ?? pitExitTime,
      prevOnPitRoad: updatedPrevOnPitRoad ?? prevOnPitRoad,
      entryLap: updatedEntryLap ?? entryLap,
      firstObservedLap: updatedFirstObservedLap ?? firstObservedLap,
      sessionTime: currentSessionTime,
      sessionState: sessionState,
      sessionUniqId: currentSessionUniqId,
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
      firstObservedLap: [],
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
  const exit =
    exitTime != null ? Math.round(exitTime) : Math.round(currentSessionTime);
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
export const usePitLap = (): number[] =>
  useStoreWithEqualityFn(
    usePitLapStore,
    (state) => state.pitLaps,
    arrayCompare
  );
export const useCarLap = (): number[] =>
  useStoreWithEqualityFn(
    usePitLapStore,
    (state) => state.carLaps,
    arrayCompare
  );
export const usePrevCarTrackSurface = (): number[] =>
  useStoreWithEqualityFn(
    usePitLapStore,
    (state) => state.prevCarTrackSurface,
    arrayCompare
  );

/**
 * @returns An array of the CarIdxLap value at which each car was first observed
 * by the overlay, indexed by carIdx. Used to determine whether the overlay has
 * watched a car since its session start (and therefore knows its true stint lap).
 */
export const useFirstObservedLap = (): number[] =>
  useStoreWithEqualityFn(
    usePitLapStore,
    (state) => state.firstObservedLap,
    arrayCompare
  );

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
