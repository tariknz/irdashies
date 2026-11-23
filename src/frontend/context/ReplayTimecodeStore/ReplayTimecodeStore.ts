import { create } from 'zustand';
import type { ReplayTimecodeSnapshot } from '@irdashies/types';

export const INITIAL_REPLAY_TIMECODE: ReplayTimecodeSnapshot = {
  active: false,
  sessionNum: 0,
  sessionTime: 0,
  frame: 0,
  frameEnd: 0,
  playSpeed: 1,
  slowMotion: false,
  atLiveEdge: false,
  program: {
    state: 'onProgram',
    sessionNum: 0,
    sessionTime: 0,
    offsetSeconds: 0,
    wasLive: false,
  },
  version: 0,
};

interface ReplayTimecodeState {
  snapshot: ReplayTimecodeSnapshot;
  setSnapshot: (snapshot: ReplayTimecodeSnapshot) => void;
  reset: () => void;
}

export const useReplayTimecodeStore = create<ReplayTimecodeState>((set) => ({
  snapshot: INITIAL_REPLAY_TIMECODE,
  setSnapshot: (snapshot) => set({ snapshot }),
  reset: () => set({ snapshot: INITIAL_REPLAY_TIMECODE }),
}));

export const useReplayTimecodeSnapshot = (): ReplayTimecodeSnapshot =>
  useReplayTimecodeStore((state) => state.snapshot);
