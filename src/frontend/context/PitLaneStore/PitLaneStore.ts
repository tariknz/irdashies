import { create } from 'zustand';
import type { PitLaneTrackData } from '@irdashies/types';

interface PitLaneState {
  // Current track's pit lane data
  currentTrackId: string | null;
  pitEntryPct: number | null;
  pitExitPct: number | null;

  // Actions
  setCurrentTrack: (trackId: string, data: PitLaneTrackData | null) => void;
  updatePitEntry: (pct: number) => void;
  updatePitExit: (pct: number) => void;
  clearPitData: () => void;
  reset: () => void;
}

// Store previous frame state outside Zustand to avoid triggering re-renders
// This runs at 60 FPS so we can't afford to update state on every frame
let previousCarIdxOnPitRoad: boolean[] = [];
let previousCarIdxTrackSurface: number[] = [];
let previousCarIdxLapDistPct: number[] = [];

// Track surface constants from iRacing SDK
const SURFACE_NOT_IN_WORLD = -1;
const SURFACE_IN_PIT_STALL = 1;

const initialState = {
  currentTrackId: null,
  pitEntryPct: null,
  pitExitPct: null,
};

export const usePitLaneStore = create<PitLaneState>((set, get) => ({
  ...initialState,

  setCurrentTrack: (trackId, data) => {
    // Reset module-level previous frame data
    previousCarIdxOnPitRoad = [];
    previousCarIdxTrackSurface = [];
    previousCarIdxLapDistPct = [];

    set({
      currentTrackId: trackId,
      pitEntryPct: data?.pitEntryPct ?? null,
      pitExitPct: data?.pitExitPct ?? null,
    });
  },

  updatePitEntry: (pct) => {
    const state = get();
    const TOLERANCE = 0.02; // 2% of lap distance

    // Update if:
    // 1. Not set yet (null), OR
    // 2. New detection is significantly different from stored value
    if (state.pitEntryPct === null ||
        Math.abs(state.pitEntryPct - pct) > TOLERANCE) {
      set({ pitEntryPct: pct });
    }
  },

  updatePitExit: (pct) => {
    const state = get();
    const TOLERANCE = 0.02; // 2% of lap distance

    // Update if:
    // 1. Not set yet (null), OR
    // 2. New detection is significantly different from stored value
    if (state.pitExitPct === null ||
        Math.abs(state.pitExitPct - pct) > TOLERANCE) {
      set({ pitExitPct: pct });
    }
  },

  clearPitData: () => {
    // Clear pit entry/exit data but keep track ID
    // Reset module-level previous frame data
    previousCarIdxOnPitRoad = [];
    previousCarIdxTrackSurface = [];
    previousCarIdxLapDistPct = [];

    set({
      pitEntryPct: null,
      pitExitPct: null,
    });
  },

  reset: () => {
    // Reset module-level previous frame data
    previousCarIdxOnPitRoad = [];
    previousCarIdxTrackSurface = [];
    previousCarIdxLapDistPct = [];
    set(initialState);
  },
}));

/**
 * Detects pit entry/exit transitions by comparing current and previous frame data.
 * Uses module-level state to avoid triggering Zustand re-renders on every frame (60 FPS).
 *
 * @param carIdxOnPitRoad Current frame's pit road flags
 * @param carIdxTrackSurface Current frame's track surface values
 * @param carIdxLapDistPct Current frame's lap distance percentages
 */
export const detectPitTransitions = (
  carIdxOnPitRoad: boolean[],
  carIdxTrackSurface: number[],
  carIdxLapDistPct: number[]
) => {
  const state = usePitLaneStore.getState();

  // Skip if this is the first frame (no previous data)
  // Just store current state and return - we can't detect transitions without a previous frame
  if (previousCarIdxOnPitRoad.length === 0) {
    // Store references directly instead of spreading arrays (avoid copies)
    previousCarIdxOnPitRoad = carIdxOnPitRoad;
    previousCarIdxTrackSurface = carIdxTrackSurface;
    previousCarIdxLapDistPct = carIdxLapDistPct;
    return;
  }

  // Check each car for pit entry/exit transitions
  for (let i = 0; i < carIdxOnPitRoad.length; i++) {
    const isOnPitRoad = carIdxOnPitRoad[i] ?? false;
    const wasOnPitRoad = previousCarIdxOnPitRoad[i] ?? false;
    const previousSurface = previousCarIdxTrackSurface[i] ?? SURFACE_NOT_IN_WORLD;
    const currentLapDistPct = carIdxLapDistPct[i];
    const prevLapDistPct = previousCarIdxLapDistPct[i];

    // Skip if no valid position data (undefined or -1 means invalid)
    if (currentLapDistPct === undefined || currentLapDistPct < 0) {
      continue;
    }

    // Skip if car wasn't in previous frame (prevents false detection on first appearance)
    const carExistedInPrevFrame = i < previousCarIdxOnPitRoad.length;

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
        state.updatePitEntry(entryPct);
      }
    }

    // Detect pit exit: OnPitRoad goes true -> false
    // When this transition occurs, surface is still 2 (OnPitRoad/exit road)
    // Surface will change to 3 (OnTrack) shortly after, but we detect on OnPitRoad transition
    if (carExistedInPrevFrame && wasOnPitRoad && !isOnPitRoad && state.pitExitPct === null) {
      state.updatePitExit(currentLapDistPct);
    }
  }

  // Store references directly instead of spreading arrays (avoid copies at 60 FPS)
  previousCarIdxOnPitRoad = carIdxOnPitRoad;
  previousCarIdxTrackSurface = carIdxTrackSurface;
  previousCarIdxLapDistPct = carIdxLapDistPct;
};
