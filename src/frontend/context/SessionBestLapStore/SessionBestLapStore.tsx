import { create, useStore } from 'zustand';

interface SessionBestLapState {
  sessionBestLap: number | undefined;
  update: (sessionBestLap: number | undefined) => void;
}

export const useSessionBestLapStore = create<SessionBestLapState>((set) => ({
  sessionBestLap: undefined,
  update: (sessionBestLap) => set({ sessionBestLap }),
}));

export const useSessionBestLap = (): number | undefined =>
  useStore(useSessionBestLapStore, (s) => s.sessionBestLap);
