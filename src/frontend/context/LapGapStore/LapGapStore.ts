import { create } from 'zustand';

// lapGaps[carIdx][lapNum] = gapToClassLeaderInSeconds
interface LapGapState {
  lapGaps: Record<number, Record<number, number>>;
  recordLapGap: (carIdx: number, lapNum: number, gapSeconds: number) => void;
  reset: () => void;
}

export const useLapGapStore = create<LapGapState>((set) => ({
  lapGaps: {},
  recordLapGap: (carIdx, lapNum, gapSeconds) =>
    set((s) => ({
      lapGaps: {
        ...s.lapGaps,
        [carIdx]: { ...(s.lapGaps[carIdx] ?? {}), [lapNum]: gapSeconds },
      },
    })),
  reset: () => set({ lapGaps: {} }),
}));
