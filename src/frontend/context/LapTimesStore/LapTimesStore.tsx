import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import logger from '@irdashies/utils/logger';
import type { LapTimesSnapshot } from '@irdashies/types';

export interface LapTimeBuffer {
  lapTimeHistory: number[][]; // [carIdx][sample]
  version: number;
}

interface LapTimesState {
  lapTimeBuffer: LapTimeBuffer | null;
  lapTimes: number[];
  sessionNum: number | null;
  reset: () => void;
  applySnapshot: (snapshot: LapTimesSnapshot) => void;
}

export const useLapTimesStore = create<LapTimesState>((set) => ({
  lapTimeBuffer: null,
  lapTimes: [],
  sessionNum: null,
  reset: () => {
    logger.info('[LapTimesStore] Resetting lap time history');
    set({
      lapTimeBuffer: null,
      lapTimes: [],
      sessionNum: null,
    });
  },
  applySnapshot: (snapshot) => {
    set({
      lapTimeBuffer: {
        lapTimeHistory: snapshot.lapTimeHistory.map((history) => [...history]),
        version: snapshot.version,
      },
      lapTimes: [...snapshot.lapTimes],
      sessionNum: snapshot.sessionNum,
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const useLapTimes = (): number[] =>
  useStore(useLapTimesStore, (state) => state.lapTimes);

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_LAP_HISTORY: number[][] = [];

const lapTimeHistoryEqual = (left: number[][], right: number[][]): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every(
      (leftHistory, carIdx) =>
        leftHistory.length === right[carIdx].length &&
        leftHistory.every((lapTime, index) => lapTime === right[carIdx][index])
    ));

/**
 * @returns Raw lap time history for each car. Returns array of arrays where [carIdx][lapIndex] contains lap time in seconds
 * Most recent lap is at the end of each car's array. Returns up to LAP_TIME_AVG_WINDOW laps per car.
 *
 * The snapshot store preserves this reference between channel publications.
 */
export const useLapTimeHistory = (): number[][] => {
  return useStoreWithEqualityFn(
    useLapTimesStore,
    (state: LapTimesState) =>
      state.lapTimeBuffer?.lapTimeHistory ?? EMPTY_LAP_HISTORY,
    lapTimeHistoryEqual
  );
};
