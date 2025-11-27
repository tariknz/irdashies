/**
 * Zustand store for fuel calculation state management
 */

import { create } from 'zustand';
import type { FuelLapData } from './types';

interface FuelStoreState {
  /** Map of lap number to fuel data */
  lapHistory: Map<number, FuelLapData>;
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
}

interface FuelStoreActions {
  /**
   * Add a completed lap's fuel data
   */
  addLapData: (lapData: FuelLapData) => void;

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
   * Get lap history as array
   */
  getLapHistory: () => FuelLapData[];
}

type FuelStore = FuelStoreState & FuelStoreActions;

/**
 * Main Zustand store for fuel calculations
 */
export const useFuelStore = create<FuelStore>((set, get) => ({
  // Initial state
  lapHistory: new Map(),
  lastLap: 0,
  lapStartFuel: 0,
  lapCrossingTime: 0,
  lastLapDistPct: 0,
  sessionNum: -1,
  wasOnPitRoad: false,
  lastSessionFlags: 0,

  // Actions
  addLapData: (lapData: FuelLapData) => {
    set((state) => {
      const newHistory = new Map(state.lapHistory);
      newHistory.set(lapData.lapNumber, lapData);

      // Keep only last 50 laps for memory efficiency
      if (newHistory.size > 50) {
        const oldestLap = Math.min(...Array.from(newHistory.keys()));
        newHistory.delete(oldestLap);
      }

      return {
        lapHistory: newHistory,
        lastLap: lapData.lapNumber,
      };
    });
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
    });
  },

  updateLapDistPct: (lapDistPct: number) => {
    set({ lastLapDistPct: lapDistPct });
  },

  clearAllData: () => {
    set({
      lapHistory: new Map(),
      lastLap: 0,
      lapStartFuel: 0,
      lapCrossingTime: 0,
      lastLapDistPct: 0,
      wasOnPitRoad: false,
      lastSessionFlags: 0,
    });
  },

  updateSessionInfo: (sessionNum: number) => {
    // Don't clear data on session change - preserve fuel consumption data
    // across warmup/qualifying/race within the same iRacing session
    // Data will only be cleared when explicitly leaving the session
    set({ sessionNum });
  },

  getLapHistory: () => {
    return Array.from(get().lapHistory.values()).sort(
      (a, b) => b.lapNumber - a.lapNumber
    );
  },
}));
