import type { Telemetry } from '@irdashies/types';
import { create, useStore } from 'zustand';

export interface LapTimeBuffer {
  lastLapTimes: number[];
  lastSessionTime: number;
  lapTimeHistory: number[][]; // [carIdx][sample]
  version: number; // Incremented when lapTimeHistory changes
}

interface LapTimesState {
  lapTimeBuffer: LapTimeBuffer | null;
  lastLapTimeUpdate: number;
  lapTimes: number[];
  lastSessionNum: number | null;
  updateLapTimes: (telemetry: Telemetry | null) => void;
}

const LAP_TIME_AVG_WINDOW = 5; // Average over last 5 laps
const LAP_TIME_UPDATE_INTERVAL = 1; // Update interval in seconds
const OUTLIER_THRESHOLD = 1.0; // Outlier detection threshold

// Helper function to calculate median
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return numbers[0];
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    // For even number of values, return average of two middle values
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    // For odd number of values, return the middle value
    return sorted[middle];
  }
}

// Helper function to calculate standard deviation
function standardDeviation(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squareDiffs = numbers.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

// Helper function to filter outliers
function filterOutliers(lapTimes: number[]): number[] {
  if (lapTimes.length < 3) return lapTimes; // Need at least 3 samples for meaningful stats
  
  const mean = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
  const stdDev = standardDeviation(lapTimes);
  const threshold = stdDev * OUTLIER_THRESHOLD;
  
  return lapTimes.filter(time => Math.abs(time - mean) <= threshold);
}

export const useLapTimesStore = create<LapTimesState>((set, get) => ({
  lapTimeBuffer: null,
  lastLapTimeUpdate: 0,
  lapTimes: [],
  lastSessionNum: null,
  updateLapTimes: (telemetry) => {
    const { lapTimeBuffer, lastLapTimeUpdate, lastSessionNum } = get();
    const sessionTime = telemetry?.SessionTime?.value?.[0] ?? 0;
    const currentSessionNum = telemetry?.SessionNum?.value?.[0] ?? null;

    // Reset lap time history when session changes (e.g., practice -> qualifying -> race)
    if (lastSessionNum !== null && currentSessionNum !== null && currentSessionNum !== lastSessionNum) {
      console.log(`[LapTimesStore] Session changed from ${lastSessionNum} to ${currentSessionNum}, resetting lap time history`);
      set({
        lapTimeBuffer: null,
        lastLapTimeUpdate: 0,
        lapTimes: [],
        lastSessionNum: currentSessionNum,
      });
      return;
    }

    // Check if enough simulation time has passed since last update
    if (sessionTime - lastLapTimeUpdate < LAP_TIME_UPDATE_INTERVAL) {
      return;
    }

    const carIdxLastLapTime = telemetry?.CarIdxLastLapTime?.value ?? [];
    if (!carIdxLastLapTime.length) {
      set({
        lapTimes: carIdxLastLapTime.map(() => 0),
        lastSessionNum: currentSessionNum,
      });
      return;
    }

    const newHistory: number[][] = lapTimeBuffer?.lapTimeHistory
      ? lapTimeBuffer.lapTimeHistory.map(arr => [...arr])
      : carIdxLastLapTime.map(() => []);

    let historyChanged = false;

    if (
      lapTimeBuffer &&
      lapTimeBuffer.lastLapTimes.length === carIdxLastLapTime.length &&
      sessionTime !== lapTimeBuffer.lastSessionTime
    ) {
      carIdxLastLapTime.forEach((lapTime, idx) => {
        const prevLapTime = lapTimeBuffer.lastLapTimes[idx];
        // Only add to history if it's a new valid lap time
        if (lapTime > 0 && lapTime !== prevLapTime) {
          if (!newHistory[idx]) newHistory[idx] = [];
          newHistory[idx].push(lapTime);
          if (newHistory[idx].length > LAP_TIME_AVG_WINDOW) newHistory[idx].shift();
          historyChanged = true;
        }
      });
    } else if (!lapTimeBuffer) {
      // First run: initialize history with current lap times
      carIdxLastLapTime.forEach((lapTime, idx) => {
        if (lapTime > 0) {
          newHistory[idx] = [lapTime];
          historyChanged = true;
        }
      });
    }

    // Calculate pace for each car by filtering outliers and using median
    const avgLapTimes = newHistory.map(arr => {
      if (arr.length === 0) return 0;
      if (arr.length === 1) return arr[0];
      
      // Filter out outliers
      const filteredTimes = filterOutliers(arr);
      // Use median of filtered times for more stable pace
      const medianValue = median(filteredTimes);

      return medianValue;
    });

    set({
      lapTimeBuffer: {
        lastLapTimes: [...carIdxLastLapTime],
        lastSessionTime: sessionTime,
        lapTimeHistory: newHistory,
        version: historyChanged ? (lapTimeBuffer?.version ?? 0) + 1 : (lapTimeBuffer?.version ?? 0),
      },
      lastLapTimeUpdate: sessionTime,
      lapTimes: avgLapTimes,
      lastSessionNum: currentSessionNum,
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const useLapTimes = (): number[] => useStore(useLapTimesStore, (state) => state.lapTimes);

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_LAP_HISTORY: number[][] = [];

// Track the last version seen to enable O(1) equality checks
let lastSeenVersion = -1;
let lastSeenHistory: number[][] = EMPTY_LAP_HISTORY;

/**
 * @returns Raw lap time history for each car. Returns array of arrays where [carIdx][lapIndex] contains lap time in seconds
 * Most recent lap is at the end of each car's array. Returns up to LAP_TIME_AVG_WINDOW laps per car.
 *
 * Performance: Uses version-based equality checking for O(1) comparison instead of deep array comparison.
 * This is critical for 24hr endurance races with 60 cars and 60 FPS telemetry updates.
 */
export const useLapTimeHistory = (): number[][] => {
  return useStore(
    useLapTimesStore,
    (state: LapTimesState) => {
      const buffer = state.lapTimeBuffer;
      if (!buffer) return EMPTY_LAP_HISTORY;

      const currentVersion = buffer.version;

      // If version hasn't changed, return the cached reference
      if (currentVersion === lastSeenVersion) {
        return lastSeenHistory;
      }

      // Version changed, update cache
      lastSeenVersion = currentVersion;
      lastSeenHistory = buffer.lapTimeHistory;
      return buffer.lapTimeHistory;
    }
  );
}; 