import { create } from 'zustand';
import type { ReplayContextSnapshot } from '@irdashies/types';

export const INITIAL_REPLAY_CONTEXT: ReplayContextSnapshot = {
  mode: 'live',
  provenance: 'none',
  subSessionId: '',
  archivedSessionNums: [],
  version: 0,
};

interface ReplayContextState {
  snapshot: ReplayContextSnapshot;
  setSnapshot: (snapshot: ReplayContextSnapshot) => void;
  reset: () => void;
}

/** Holds one small snapshot, replaced on change, so it needs no cap (R3.2). */
export const useReplayContextStore = create<ReplayContextState>((set) => ({
  snapshot: INITIAL_REPLAY_CONTEXT,
  setSnapshot: (snapshot) => set({ snapshot }),
  reset: () => set({ snapshot: INITIAL_REPLAY_CONTEXT }),
}));

/** Live, spectating or a loaded replay file, and where its history comes from. */
export const useReplayContextSnapshot = (): ReplayContextSnapshot =>
  useReplayContextStore((state) => state.snapshot);
