import { create } from 'zustand';

// lapGaps[carIdx][lapNum] = gapToClassLeaderInSeconds
interface LapGapState {
  lapGaps: Record<number, Record<number, number>>;
  sessionNum: number | null;
  recordLapGap: (carIdx: number, lapNum: number, gapSeconds: number) => void;
  setSessionNum: (sessionNum: number) => void;
  reset: () => void;
}

export const useLapGapStore = create<LapGapState>((set) => ({
  lapGaps: {},
  sessionNum: null,
  recordLapGap: (carIdx, lapNum, gapSeconds) =>
    set((s) => ({
      lapGaps: {
        ...s.lapGaps,
        [carIdx]: { ...(s.lapGaps[carIdx] ?? {}), [lapNum]: gapSeconds },
      },
    })),
  setSessionNum: (sessionNum) =>
    set((state) =>
      state.sessionNum === sessionNum ? state : { lapGaps: {}, sessionNum }
    ),
  reset: () => set({ lapGaps: {}, sessionNum: null }),
}));
