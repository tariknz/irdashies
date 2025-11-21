import { create, useStore } from 'zustand';

interface PitLapState {
  sessionUniqId: number;
  pitLaps: number[]; // [carIdx]
  carLaps: number[]; // [carIdx]
  actualCarTrackSurface: number[]
  prevCarTrackSurface: number[] // [carIdx],
  sessionTime: number;
  updatePitLaps: (
    carIdxOnPitRoad: number[] | null,
    carIdxLap: number[] | null,
    currentSessionUniqId: number | null,
    currentSessionTime: number | null,
    carIdxTrackSurface: number[] | null,
    sessionState: number | null
  ) => void;
}

export const usePitLapStore = create<PitLapState>((set, get) => ({
  sessionUniqId: 0,
  sessionTime: 0,
  pitLaps: [],
  carLaps: [],
  prevCarTrackSurface: [],
  actualCarTrackSurface: [],
  updatePitLaps: (carIdxOnPitRoad, carIdxLap, currentSessionUniqId, currentSessionTime, carIdxTrackSurface, sessionState) => {
    const { sessionUniqId, pitLaps, sessionTime, prevCarTrackSurface, actualCarTrackSurface} = get();
    const safeCarIdxOnPitRoad = carIdxOnPitRoad ?? [];
    const safeCarIdxLap = carIdxLap ?? [];
    const safeCurrentSessionUniqId = currentSessionUniqId ?? 0;
    const safeCurrentSessionTime = currentSessionTime ?? 0;
    const safeCarIdxTrackSurface = carIdxTrackSurface ?? [];
    const safeSessionState = sessionState ?? 0;

    // reset store when session was changed
    if ((sessionUniqId !== 0 && safeCurrentSessionUniqId !== sessionUniqId) || sessionTime>safeCurrentSessionTime) {
      set({ sessionUniqId: safeCurrentSessionUniqId,
            pitLaps: [],
            carLaps: [],
            actualCarTrackSurface: [],
            prevCarTrackSurface: [],
            sessionTime: safeCurrentSessionTime
      })
      return
    }

    safeCarIdxOnPitRoad.forEach((inPit, idx) => {
      if (inPit) {
        pitLaps[idx] = safeCarIdxLap[idx];
      }
    });

    safeCarIdxTrackSurface.forEach((location, idx) => {
      if (actualCarTrackSurface[idx] !== location && safeSessionState < 5 && location != -1) {
        prevCarTrackSurface[idx] = actualCarTrackSurface[idx];
        actualCarTrackSurface[idx] = location;
      }
    });

    set({
      pitLaps: pitLaps,
      carLaps: safeCarIdxLap,
      prevCarTrackSurface: prevCarTrackSurface,
      actualCarTrackSurface: actualCarTrackSurface,
      sessionTime: safeCurrentSessionTime,
      sessionUniqId: safeCurrentSessionUniqId
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const usePitLap = (): number[] => useStore(usePitLapStore, (state) => state.pitLaps);
export const useCarLap = (): number[] => useStore(usePitLapStore, (state) => state.carLaps);
export const usePrevCarTrackSurface = (): number[] => useStore(usePitLapStore, (state) => state.prevCarTrackSurface);