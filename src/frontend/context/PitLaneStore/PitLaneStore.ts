import { create } from 'zustand';
import type { PitLaneTrackData } from '@irdashies/types';

interface PitLaneState {
  // Current track's pit lane data
  currentTrackId: string | null;
  pitEntryPct: number | null;
  pitExitPct: number | null;

  // Previous frame state for transition detection
  previousCarIdxOnPitRoad: boolean[];
  previousCarIdxTrackSurface: number[];
  previousCarIdxLapDistPct: number[];

  // Actions
  setCurrentTrack: (trackId: string, data: PitLaneTrackData | null) => void;
  updatePitEntry: (pct: number) => void;
  updatePitExit: (pct: number) => void;
  detectTransitions: (
    carIdxOnPitRoad: boolean[],
    carIdxTrackSurface: number[],
    carIdxLapDistPct: number[]
  ) => void;
  reset: () => void;
}

// Track surface constants from iRacing SDK
const SURFACE_NOT_IN_WORLD = -1;
const SURFACE_IN_PIT_STALL = 1;

const initialState = {
  currentTrackId: null,
  pitEntryPct: null,
  pitExitPct: null,
  previousCarIdxOnPitRoad: [] as boolean[],
  previousCarIdxTrackSurface: [] as number[],
  previousCarIdxLapDistPct: [] as number[],
};

export const usePitLaneStore = create<PitLaneState>((set, get) => ({
  ...initialState,

  setCurrentTrack: (trackId, data) => {
    set({
      currentTrackId: trackId,
      pitEntryPct: data?.pitEntryPct ?? null,
      pitExitPct: data?.pitExitPct ?? null,
      previousCarIdxOnPitRoad: [],
      previousCarIdxTrackSurface: [],
      previousCarIdxLapDistPct: [],
    });
  },

  updatePitEntry: (pct) => {
    const state = get();
    // Only update if not already set (first detection wins)
    if (state.pitEntryPct === null) {
      set({ pitEntryPct: pct });
    }
  },

  updatePitExit: (pct) => {
    const state = get();
    // Only update if not already set (first detection wins)
    if (state.pitExitPct === null) {
      set({ pitExitPct: pct });
    }
  },

  detectTransitions: (carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct) => {
    const state = get();
    const previousOnPitRoad = state.previousCarIdxOnPitRoad;
    const previousTrackSurface = state.previousCarIdxTrackSurface;
    const previousLapDistPct = state.previousCarIdxLapDistPct;

    // Skip if this is the first frame (no previous data)
    // Just store current state and return - we can't detect transitions without a previous frame
    if (previousOnPitRoad.length === 0) {
      set({
        previousCarIdxOnPitRoad: [...carIdxOnPitRoad],
        previousCarIdxTrackSurface: [...carIdxTrackSurface],
        previousCarIdxLapDistPct: [...carIdxLapDistPct],
      });
      return;
    }

    // Check each car for pit entry/exit transitions
    for (let i = 0; i < carIdxOnPitRoad.length; i++) {
      const isOnPitRoad = carIdxOnPitRoad[i] ?? false;
      const wasOnPitRoad = previousOnPitRoad[i] ?? false;
      const previousSurface = previousTrackSurface[i] ?? SURFACE_NOT_IN_WORLD;
      const currentLapDistPct = carIdxLapDistPct[i];
      const prevLapDistPct = previousLapDistPct[i];

      // Skip if no valid position data (undefined or -1 means invalid)
      if (currentLapDistPct === undefined || currentLapDistPct < 0) {
        continue;
      }

      // Skip if car wasn't in previous frame (prevents false detection on first appearance)
      const carExistedInPrevFrame = i < previousOnPitRoad.length;

      // Detect pit entry: OnPitRoad goes false -> true
      // When this transition occurs, surface has already changed to 2 (OnPitRoad)
      // REJECT if previousSurface=1 (car leaving pitbox also triggers OnPitRoad false->true)
      // ACCEPT if previousSurface=3 (car was on track) or previousSurface=2 (car entering from track)
      if (carExistedInPrevFrame && !wasOnPitRoad && isOnPitRoad && state.pitEntryPct === null) {
        // Reject if car was in pit stall (leaving pitbox case)
        const wasInPitStall = previousSurface === SURFACE_IN_PIT_STALL;

        if (wasInPitStall) {
          continue;
        }

        const hasPrevPos = prevLapDistPct !== undefined && prevLapDistPct >= 0;
        const entryPct = hasPrevPos ? prevLapDistPct : currentLapDistPct;

        // Detect wrap-around: if both current and previous positions are low (<20%),
        // but we're detecting pit entry, the car likely entered from near end of lap.
        // The telemetry update rate wasn't fast enough to capture position before wrap-around.
        const bothPositionsLow = entryPct < 0.2 && currentLapDistPct < 0.2;
        if (!bothPositionsLow) {
          get().updatePitEntry(entryPct);
        }
      }

      // Detect pit exit: OnPitRoad goes true -> false
      // When this transition occurs, surface is still 2 (OnPitRoad/exit road)
      // Surface will change to 3 (OnTrack) shortly after, but we detect on OnPitRoad transition
      if (carExistedInPrevFrame && wasOnPitRoad && !isOnPitRoad && state.pitExitPct === null) {
        get().updatePitExit(currentLapDistPct);
      }
    }

    // Update previous state for next frame
    set({
      previousCarIdxOnPitRoad: [...carIdxOnPitRoad],
      previousCarIdxTrackSurface: [...carIdxTrackSurface],
      previousCarIdxLapDistPct: [...carIdxLapDistPct],
    });
  },

  reset: () => set(initialState),
}));
