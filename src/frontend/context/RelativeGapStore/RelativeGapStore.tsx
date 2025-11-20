/**
 * Zustand store for managing relative gap calculation state
 * Stores position/time records and provides access to gap calculations
 */

import { create } from 'zustand';
import type {
  RelativeGapStoreState,
  CarPositionHistory,
  PositionSample,
  LapPositionRecord,
  RelativeGapConfig,
} from './types';
import { normalizePosition } from './InterpolationEngine';
import { isValidLap } from './RelativeGapCalculator';

/**
 * Default configuration for the relative gap system
 */
const DEFAULT_CONFIG: RelativeGapConfig = {
  sampleInterval: 0.01, // 1% of track
  maxLapHistory: 5, // Keep last 5 laps
  interpolationMethod: 'linear', // Start with linear, upgrade to cubic later
  smoothingFactor: 0.3, // Exponential moving average factor
  enabled: true, // Enable by default
};

/**
 * Create a new empty car history
 */
function createCarHistory(carIdx: number): CarPositionHistory {
  return {
    carIdx,
    lapRecords: [],
    currentLapSamples: [],
    lastPosition: 0,
    currentLapNumber: 0,
    lapStartTime: 0,
  };
}

interface RelativeGapStoreActions {
  /**
   * Initialize or update car history tracking
   */
  initializeCarHistory: (carIdx: number, currentLap: number, sessionTime: number) => void;

  /**
   * Add a position sample for a car's current lap
   */
  addPositionSample: (
    carIdx: number,
    position: number,
    sessionTime: number,
    currentLap: number,
  ) => void;

  /**
   * Complete a lap and store the position record
   */
  completeLap: (carIdx: number, lapTime: number, sessionTime: number) => void;

  /**
   * Process position updates from telemetry for all cars
   * This is the main update function that should be called from the updater hook
   */
  processPositionUpdates: (params: {
    sessionTime: number;
    sessionNum: number;
    trackLength: number;
    carIdxLapDistPct: number[];
    carIdxLap: number[];
    carIdxLastLapTime: number[];
    lastLapNumbers: Map<number, number>;
  }) => Map<number, number>;

  /**
   * Clear all data (e.g., on session change)
   */
  clearAllData: () => void;

  /**
   * Update configuration
   */
  updateConfig: (config: Partial<RelativeGapConfig>) => void;

  /**
   * Update session info (track length, session number)
   */
  updateSessionInfo: (sessionNum: number, trackLength: number) => void;

  /**
   * Get car history for a specific car
   */
  getCarHistory: (carIdx: number) => CarPositionHistory | undefined;
}

export type RelativeGapStore = RelativeGapStoreState & RelativeGapStoreActions;

/**
 * Main Zustand store for relative gap calculations
 */
export const useRelativeGapStore = create<RelativeGapStore>((set, get) => ({
  // Initial state
  carHistories: new Map(),
  config: DEFAULT_CONFIG,
  sessionNum: -1,
  trackLength: 0,

  // Actions
  initializeCarHistory: (carIdx: number, currentLap: number, sessionTime: number) => {
    set((state) => {
      const newHistories = new Map(state.carHistories);

      if (!newHistories.has(carIdx)) {
        const history = createCarHistory(carIdx);
        history.currentLapNumber = currentLap;
        history.lapStartTime = sessionTime;
        newHistories.set(carIdx, history);
      }

      return { carHistories: newHistories };
    });
  },

  addPositionSample: (
    carIdx: number,
    position: number,
    sessionTime: number,
    currentLap: number,
  ) => {
    const state = get();
    const config = state.config;

    if (!config.enabled) return;

    set((state) => {
      const newHistories = new Map(state.carHistories);
      let history = newHistories.get(carIdx);

      // Initialize if needed
      if (!history) {
        history = createCarHistory(carIdx);
        history.currentLapNumber = currentLap;
        history.lapStartTime = sessionTime;
      }

      // Check if we've started a new lap
      if (currentLap !== history.currentLapNumber) {
        // Don't auto-complete lap here - wait for explicit completeLap call
        // Just update the lap number and reset samples
        history.currentLapNumber = currentLap;
        history.currentLapSamples = [];
        history.lapStartTime = sessionTime;
      }

      const normalizedPos = normalizePosition(position);

      // Check if we should add a sample
      // Only add if position has advanced by at least sampleInterval
      const shouldSample =
        history.currentLapSamples.length === 0 ||
        normalizedPos >= history.lastPosition + config.sampleInterval ||
        normalizedPos < history.lastPosition - 0.5; // Handle wrap-around

      if (shouldSample) {
        const sample: PositionSample = {
          position: normalizedPos,
          time: sessionTime - history.lapStartTime,
          sessionTime,
        };

        history.currentLapSamples.push(sample);
        history.lastPosition = normalizedPos;
      }

      newHistories.set(carIdx, { ...history });
      return { carHistories: newHistories };
    });
  },

  completeLap: (carIdx: number, lapTime: number, sessionTime: number) => {
    set((state) => {
      const newHistories = new Map(state.carHistories);
      const history = newHistories.get(carIdx);

      if (!history || history.currentLapSamples.length < 10) {
        // Not enough samples to create a valid record
        return state;
      }

      // Sort samples by position
      const sortedSamples = [...history.currentLapSamples].sort(
        (a, b) => a.position - b.position,
      );

      // Determine if this lap is valid (not an outlier)
      const recentLapTimes = history.lapRecords
        .filter((lap) => lap.isValid)
        .map((lap) => lap.lapTime);
      const valid = isValidLap(lapTime, recentLapTimes);

      // Create lap record
      const lapRecord: LapPositionRecord = {
        lapNumber: history.currentLapNumber,
        samples: sortedSamples,
        lapTime,
        completedAt: sessionTime,
        isValid: valid,
      };

      // Add to history and limit to maxLapHistory
      history.lapRecords.push(lapRecord);
      if (history.lapRecords.length > state.config.maxLapHistory) {
        history.lapRecords.shift(); // Remove oldest
      }

      // Reset current lap samples
      history.currentLapSamples = [];
      history.lapStartTime = sessionTime;
      history.currentLapNumber++;

      newHistories.set(carIdx, { ...history });
      return { carHistories: newHistories };
    });
  },

  clearAllData: () => {
    set({
      carHistories: new Map(),
    });
  },

  updateConfig: (config: Partial<RelativeGapConfig>) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  updateSessionInfo: (sessionNum: number, trackLength: number) => {
    set((state) => {
      // Clear data if session changed
      if (state.sessionNum !== sessionNum && state.sessionNum !== -1) {
        return {
          sessionNum,
          trackLength,
          carHistories: new Map(),
        };
      }

      return { sessionNum, trackLength };
    });
  },

  processPositionUpdates: (params) => {
    const {
      sessionTime,
      sessionNum,
      trackLength,
      carIdxLapDistPct,
      carIdxLap,
      carIdxLastLapTime,
      lastLapNumbers,
    } = params;

    // Update session info (will clear data on session change)
    get().updateSessionInfo(sessionNum, trackLength);

    // Create new map to track updated lap numbers
    const updatedLapNumbers = new Map(lastLapNumbers);

    // Process each car
    for (let carIdx = 0; carIdx < carIdxLapDistPct.length; carIdx++) {
      const position = carIdxLapDistPct[carIdx];
      const currentLap = carIdxLap[carIdx];
      const lastLapTime = carIdxLastLapTime[carIdx];

      // Skip invalid positions
      if (position < 0 || currentLap < 0) continue;

      // Initialize car history if needed
      get().initializeCarHistory(carIdx, currentLap, sessionTime);

      // Detect lap completion
      const previousLap = lastLapNumbers.get(carIdx) ?? currentLap;
      if (currentLap > previousLap && lastLapTime > 0) {
        // Lap completed!
        get().completeLap(carIdx, lastLapTime, sessionTime);
      }

      // Update last lap number
      updatedLapNumbers.set(carIdx, currentLap);

      // Add position sample for current lap
      get().addPositionSample(carIdx, position, sessionTime, currentLap);
    }

    return updatedLapNumbers;
  },

  getCarHistory: (carIdx: number) => {
    return get().carHistories.get(carIdx);
  },
}));

/**
 * Hook to get the current configuration
 * Uses shallow equality to prevent unnecessary re-renders
 */
export function useRelativeGapConfig() {
  return useRelativeGapStore((state) => state.config);
}

/**
 * Hook to get a specific car's history
 */
export function useCarPositionHistory(carIdx: number) {
  return useRelativeGapStore((state) => state.carHistories.get(carIdx));
}

/**
 * Hook to get all car histories
 */
export function useAllCarHistories() {
  return useRelativeGapStore((state) => state.carHistories);
}

/**
 * Hook to check if the system is enabled
 */
export function useIsRelativeGapEnabled() {
  return useRelativeGapStore((state) => state.config.enabled);
}
