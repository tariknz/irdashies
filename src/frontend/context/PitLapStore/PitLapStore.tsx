import type { Telemetry } from '@irdashies/types';
import { create, useStore } from 'zustand';

interface PitLapState {
  sessionUniqId: number;
  pitLaps: number[]; // [carIdx]
  updatePitLaps: (telemetry: Telemetry | null) => void;
}

export const usePitLapStore = create<PitLapState>((set, get) => ({
  sessionUniqId: 0,
  pitLaps: [],
  updatePitLaps: (telemetry) => {
    const { sessionUniqId } = get();
    const pitLaps :  number[] = [];
    const carIdxOnPitRoad = telemetry?.CarIdxOnPitRoad?.value ?? [];
    const carIdxLap = telemetry?.CarIdxLap?.value ?? [];
    const newSessionUniqId = telemetry?.SessionUniqueID?.value?.[0] ?? 0;

    // reset store when session was changed
    if (newSessionUniqId !== 0 && newSessionUniqId !== sessionUniqId) {
      set({ pitLaps: carIdxOnPitRoad.map((inPit, idx) => 0) });
    }

    if (!carIdxOnPitRoad.length) {
      set({ sessionUniqId: sessionUniqId})
      set({ pitLaps: carIdxOnPitRoad.map((inPit, idx) => 0) });
      return;
    }

    carIdxOnPitRoad.forEach((inPit, idx) => {
      if (inPit) {
        pitLaps[idx] = carIdxLap[idx];
      }
    });

    set({
      pitLaps: pitLaps
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const usePitLap = (): number[] => useStore(usePitLapStore, (state) => state.pitLaps);