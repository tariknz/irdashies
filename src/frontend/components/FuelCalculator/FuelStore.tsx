/**
 * Zustand store for fuel calculation state management
 */

import { create } from 'zustand';
import { FuelLapData } from '@irdashies/types';

/** Maximum number of laps to retain in history */
const MAX_LAP_HISTORY = 50;

interface FuelStoreState {
  /** Map of lap number to fuel data */
  lapHistory: Map<number, FuelLapData>;
  /** Cached sorted array of lap history (most recent first) - invalidated on changes */
  _sortedLapHistoryCache: FuelLapData[] | null;
  /** Track the oldest lap number for efficient pruning */
  _oldestLapNumber: number;
  /** Last known lap number */
  lastLap: number;
  /** Fuel level at start of current lap */
  lapStartFuel: number;
  /** Session time at lap crossing */
  lapCrossingTime: number;
  /** Last lap distance percentage (to detect crossing) */
  lastLapDistPct: number;
  /** Current session number (to detect session changes) */
  sessionNum: number;
  /** Whether the car was on pit road at lap start */
  wasOnPitRoad: boolean;
  /** Last session flags to detect flag changes */
  lastSessionFlags: number;
  /** Persistent maximum fuel consumption from qualifying session */
  qualifyConsumption: number | null;
  /** Current track ID for invalidation */
  trackId?: string | number;
  /** Current car identifier for invalidation */
  carName?: string;
  /** Accumulated fuel added during the current lap (from pit stops) */
  accumulatedRefuel: number;
}

interface FuelStoreActions {
  /**
   * Add a completed lap's fuel data
   */
  addLapData: (lapData: FuelLapData) => void;

  /**
   * Add detected refuel amount to the current lap
   */
  addRefuel: (amount: number) => void;

  /**
   * Update lap crossing state
   */
  updateLapCrossing: (
    lapDistPct: number,
    fuelLevel: number,
    sessionTime: number,
    currentLap: number,
    isOnPitRoad: boolean
  ) => void;

  /**
   * Update just the lap distance percentage (for tracking lap crossing)
   */
  updateLapDistPct: (lapDistPct: number) => void;

  /**
   * Clear all data (e.g., on session change)
   */
  clearAllData: () => void;

  /**
   * Update session info
   */
  updateSessionInfo: (sessionNum: number) => void;

  /**
   * Get lap history as sorted array (most recent first)
   * Uses cached version when available
   */
  getLapHistory: () => FuelLapData[];

  /**
   * Get recent N laps (most recent first)
   */
  getRecentLaps: (count: number) => FuelLapData[];

  /**
   * Set the qualifying consumption value
   */
  setQualifyConsumption: (val: number | null) => void;
  setContextInfo: (trackId?: string | number, carName?: string) => void;
  setLapHistory: (laps: FuelLapData[]) => void;
}

type FuelStore = FuelStoreState & FuelStoreActions;

/**
 * Sort laps by lap number descending (most recent first)
 */
/**
 * Sort laps by timestamp descending (most recent first)
 * Fallback to lap number if timestamp is missing
 */
function sortLapsDescending(laps: FuelLapData[]): FuelLapData[] {
  return laps.sort((a, b) => {
    const timeA = a.timestamp || 0;
    const timeB = b.timestamp || 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.lapNumber - a.lapNumber;
  });
}

/**
 * Main Zustand store for fuel calculations
 */
export const useFuelStore = create<FuelStore>()((set, get) => ({
  // Initial state
  lapHistory: new Map(),
  _sortedLapHistoryCache: null,
  _oldestLapNumber: Infinity,
  lastLap: 0,
  lapStartFuel: 0,
  lapCrossingTime: 0,
  lastLapDistPct: 0,
  sessionNum: -1,
  wasOnPitRoad: false,
  lastSessionFlags: 0,
  qualifyConsumption: null,
  accumulatedRefuel: 0,
  trackId: undefined,
  carName: undefined,

  // Actions
  addLapData: (lapData: FuelLapData) => {
    set((state) => {
      const newHistory = new Map(state.lapHistory);
      newHistory.set(lapData.lapNumber, lapData);

      // Track oldest lap number for efficient pruning
      let oldestLapNumber = Math.min(state._oldestLapNumber, lapData.lapNumber);

      // Prune if over limit - use tracked oldest lap number instead of searching
      if (newHistory.size > MAX_LAP_HISTORY) {
        newHistory.delete(oldestLapNumber);
        // Find new oldest - only needed after deletion
        oldestLapNumber = Infinity;
        for (const key of newHistory.keys()) {
          if (key < oldestLapNumber) {
            oldestLapNumber = key;
          }
        }
      }

      return {
        lapHistory: newHistory,
        _sortedLapHistoryCache: null, // Invalidate cache
        _oldestLapNumber: oldestLapNumber,
        lastLap: lapData.lapNumber,
      };
    });
  },

  addRefuel: (amount: number) => {
    set((state) => ({ accumulatedRefuel: state.accumulatedRefuel + amount }));
  },

  updateLapCrossing: (
    lapDistPct: number,
    fuelLevel: number,
    sessionTime: number,
    currentLap: number,
    isOnPitRoad: boolean
  ) => {
    set({
      lastLapDistPct: lapDistPct,
      lapStartFuel: fuelLevel,
      lapCrossingTime: sessionTime,
      lastLap: currentLap,
      wasOnPitRoad: isOnPitRoad,
      accumulatedRefuel: 0, // Reset accumulated refuel for the new lap
    });
  },

  updateLapDistPct: (lapDistPct: number) => {
    set({ lastLapDistPct: lapDistPct });
  },

  clearAllData: () => {
    set({
      lapHistory: new Map(),
      _sortedLapHistoryCache: null,
      _oldestLapNumber: Infinity,
      lastLap: 0,
      lapStartFuel: 0,
      lapCrossingTime: 0,
      lastLapDistPct: 0,
      wasOnPitRoad: false,
      lastSessionFlags: 0,
      accumulatedRefuel: 0,
      // qualifyConsumption is INTENTIONALLY preservation across session changes
      // It should only be cleared if we detect a track change (handled in useFuelCalculation)
      // or if we decide to add a hard reset button later.
    });
  },

  updateSessionInfo: (sessionNum: number) => {
    set({ sessionNum });
  },

  getLapHistory: () => {
    const state = get();

    // Return cached version if available
    if (state._sortedLapHistoryCache !== null) {
      return state._sortedLapHistoryCache;
    }

    // Build and cache sorted array
    const sorted = sortLapsDescending(Array.from(state.lapHistory.values()));

    return sorted;
  },

  getRecentLaps: (count: number) => {
    const state = get();

    // For small counts, it's faster to iterate the map directly
    // than to sort the entire history
    if (state.lapHistory.size <= count) {
      return sortLapsDescending(Array.from(state.lapHistory.values()));
    }

    // Use cached sorted array if available
    if (state._sortedLapHistoryCache !== null) {
      return state._sortedLapHistoryCache.slice(0, count);
    }

    // Otherwise get full sorted array and slice
    return get().getLapHistory().slice(0, count);
  },

  setQualifyConsumption: (val) => {
    set({ qualifyConsumption: val });
  },

  setContextInfo: (trackId, carName) => {
    set({ trackId, carName });
  },

  setLapHistory: (laps) => {
    set(() => {
      const newHistory = new Map();
      let oldestLapNumber = Infinity;

      laps.forEach((lap) => {
        newHistory.set(lap.lapNumber, { ...lap, isHistorical: true });
        if (lap.lapNumber < oldestLapNumber) {
          oldestLapNumber = lap.lapNumber;
        }
      });

      return {
        lapHistory: newHistory,
        _sortedLapHistoryCache: null,
        _oldestLapNumber: oldestLapNumber,
        lastLap:
          laps.length > 0 ? Math.max(...laps.map((l) => l.lapNumber)) : 0,
      };
    });
  },
}));

// ============================================================================
// Selectors for optimized component subscriptions
// ============================================================================

/**
 * Selector to get lap history size (for triggering recalculations)
 * More efficient than subscribing to the entire Map
 */
export const selectLapHistorySize = (state: FuelStore): number =>
  state.lapHistory.size;

/**
 * Selector to get the most recent lap data (reactive to lastLap changes)
 */
export const selectLastLapData = (state: FuelStore): FuelLapData | null => {
  if (state.lapHistory.size === 0) return null;

  // Use lastLap as the primary key, but if it doesn't exist in history (e.g. we just moved to next lap),
  // find the highest lap number actually present in the history.
  if (state.lastLap > 0 && state.lapHistory.has(state.lastLap)) {
    return state.lapHistory.get(state.lastLap) ?? null;
  }

  // Fallback: find the highest lap number in the map
  const lapNumbers = Array.from(state.lapHistory.keys());
  const maxLap = Math.max(...lapNumbers);
  return state.lapHistory.get(maxLap) ?? null;
};

/**
 * Selector to get the most recent lap fuel usage (reactive)
 */
export const selectLastLapUsage = (state: FuelStore): number => {
  const lastLapData = selectLastLapData(state);
  return lastLapData?.fuelUsed ?? 0;
};

/**
 * Selector to get the last lap number
 */
export const selectLastLap = (state: FuelStore): number => state.lastLap;

/**
 * Selector to get lap crossing state for detection logic
 */
export const selectLapCrossingState = (
  state: FuelStore
): {
  lastLapDistPct: number;
  lapStartFuel: number;
  lapCrossingTime: number;
  wasOnPitRoad: boolean;
} => ({
  lastLapDistPct: state.lastLapDistPct,
  lapStartFuel: state.lapStartFuel,
  lapCrossingTime: state.lapCrossingTime,
  wasOnPitRoad: state.wasOnPitRoad,
});
