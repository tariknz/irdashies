import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';

export interface BattleGapSnapshot {
  /** Gap to the car ahead (negative = ahead, positive = behind relative to player) */
  gapAhead: number | null;
  /** Gap to the car behind (positive = behind) */
  gapBehind: number | null;
  /** Previous lap snapshot */
  prevGapAhead: number | null;
  prevGapBehind: number | null;
  /** The player lap on which the snapshot was taken */
  snapshotLap: number;
}

interface BattleGapState extends BattleGapSnapshot {
  /** Update snapshot when the player completes a new lap */
  snapshot: (
    gapAhead: number | null,
    gapBehind: number | null,
    playerLap: number
  ) => void;
  reset: () => void;
}

const initialState: BattleGapSnapshot = {
  gapAhead: null,
  gapBehind: null,
  prevGapAhead: null,
  prevGapBehind: null,
  snapshotLap: -1,
};

export const useBattleGapStore = create<BattleGapState>((set, get) => ({
  ...initialState,
  snapshot: (gapAhead, gapBehind, playerLap) => {
    const { snapshotLap, gapAhead: prevAhead, gapBehind: prevBehind } = get();

    // Only snapshot once per lap
    if (playerLap === snapshotLap) return;

    set({
      prevGapAhead: prevAhead,
      prevGapBehind: prevBehind,
      gapAhead,
      gapBehind,
      snapshotLap: playerLap,
    });
  },
  reset: () => set({ ...initialState }),
}));

export const useBattleGapSnapshot = (): BattleGapSnapshot =>
  useStoreWithEqualityFn(
    useBattleGapStore,
    (s) => ({
      gapAhead: s.gapAhead,
      gapBehind: s.gapBehind,
      prevGapAhead: s.prevGapAhead,
      prevGapBehind: s.prevGapBehind,
      snapshotLap: s.snapshotLap,
    }),
    (a, b) =>
      a.gapAhead === b.gapAhead &&
      a.gapBehind === b.gapBehind &&
      a.prevGapAhead === b.prevGapAhead &&
      a.prevGapBehind === b.prevGapBehind &&
      a.snapshotLap === b.snapshotLap
  );
