import type { Telemetry } from '@irdashies/types';
import { create, useStore } from 'zustand';

interface PitLapState {
  sessionUniqId: number;
  pitLaps: number[]; // [carIdx]
  carLaps: number[]; // [carIdx]
  actualCarTrackSurface: number[]
  prevCarTrackSurface: number[] // [carIdx],
  sessionTime: number;
  updatePitLaps: (telemetry: Telemetry | null) => void;
}

export const usePitLapStore = create<PitLapState>((set, get) => ({
  sessionUniqId: 0,
  sessionTime: 0,
  pitLaps: [],
  carLaps: [],
  prevCarTrackSurface: [],
  actualCarTrackSurface: [],
  updatePitLaps: (telemetry) => {
    const { sessionUniqId, pitLaps, sessionTime, prevCarTrackSurface, actualCarTrackSurface} = get();
    const carIdxOnPitRoad = telemetry?.CarIdxOnPitRoad?.value ?? [];
    const carIdxLap = telemetry?.CarIdxLap?.value ?? [];
    const carIdxLapCompleted = telemetry?.CarIdxLapCompleted?.value ?? [];
    const currentSessionUniqId = telemetry?.SessionUniqueID?.value?.[0] ?? 0;
    const currentSessionTime = telemetry?.SessionTime?.value?.[0] ?? 0;
    const carIdxTrackSurface = telemetry?.CarIdxTrackSurface?.value ?? [];
    const sessionState = telemetry?.SessionState?.value?.[0] ?? 0;

    // reset store when session was changed
    if ((sessionUniqId !== 0 && currentSessionUniqId !== sessionUniqId) || sessionTime>currentSessionTime) {
      set({ sessionUniqId: currentSessionUniqId,
            pitLaps: [],
            carLaps: [],
            actualCarTrackSurface: [],
            prevCarTrackSurface: [],
            sessionTime: currentSessionTime
      })
      return
    }

    carIdxOnPitRoad.forEach((inPit, idx) => {
      if (inPit) {
        pitLaps[idx] = carIdxLap[idx];
      }
    });

    carIdxTrackSurface.forEach((location, idx) => {
      if (actualCarTrackSurface[idx] !== location && sessionState < 5 && location != -1) {
        prevCarTrackSurface[idx] = actualCarTrackSurface[idx];
        actualCarTrackSurface[idx] = location;
      }
    });

    set({
      pitLaps: pitLaps,
      carLaps: carIdxLap,
      prevCarTrackSurface: prevCarTrackSurface,
      actualCarTrackSurface: actualCarTrackSurface,
      sessionTime: currentSessionTime,
      sessionUniqId: currentSessionUniqId
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const usePitLap = (): number[] => useStore(usePitLapStore, (state) => state.pitLaps);
export const useCarLap = (): number[] => useStore(usePitLapStore, (state) => state.carLaps);
export const usePrevCarTrackSurface = (): number[] => useStore(usePitLapStore, (state) => state.prevCarTrackSurface);