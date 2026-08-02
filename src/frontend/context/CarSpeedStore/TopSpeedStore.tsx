import { create, useStore } from 'zustand';

interface TopSpeedState {
  currentLapMax: number;
  lastLapTopSpeed: number | null;
  sessionBestTopSpeed: number | null;
  lastSeenLap: number | null;
  sessionNum: number | null;
  update: (speed: number, lap: number, sessionNum: number | null) => void;
  reset: () => void;
}

export const useTopSpeedStore = create<TopSpeedState>((set, get) => ({
  currentLapMax: 0,
  lastLapTopSpeed: null,
  sessionBestTopSpeed: null,
  lastSeenLap: null,
  sessionNum: null,

  update: (speed, lap, sessionNum) => {
    const state = get();

    if (sessionNum !== null && state.sessionNum !== null && sessionNum !== state.sessionNum) {
      set({
        currentLapMax: speed,
        lastLapTopSpeed: null,
        sessionBestTopSpeed: null,
        lastSeenLap: lap,
        sessionNum,
      });
      return;
    }

    if (state.lastSeenLap === null) {
      set({ currentLapMax: speed, lastSeenLap: lap, sessionNum });
      return;
    }

    if (lap > state.lastSeenLap) {
      const completedLapMax = state.currentLapMax;
      const newSessionBest =
        state.sessionBestTopSpeed === null || completedLapMax > state.sessionBestTopSpeed
          ? completedLapMax
          : state.sessionBestTopSpeed;
      set({
        lastLapTopSpeed: completedLapMax,
        sessionBestTopSpeed: newSessionBest,
        currentLapMax: speed,
        lastSeenLap: lap,
        sessionNum,
      });
      return;
    }

    if (speed > state.currentLapMax) {
      set({ currentLapMax: speed, sessionNum });
    }
  },

  reset: () =>
    set({
      currentLapMax: 0,
      lastLapTopSpeed: null,
      sessionBestTopSpeed: null,
      lastSeenLap: null,
      sessionNum: null,
    }),
}));

export const useLastLapTopSpeed = (): number | null =>
  useStore(useTopSpeedStore, (s) => s.lastLapTopSpeed);

export const useSessionBestTopSpeed = (): number | null =>
  useStore(useTopSpeedStore, (s) => s.sessionBestTopSpeed);
