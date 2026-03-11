import { create, useStore } from 'zustand';

export interface LapTimeBuffer {
  lastLapTimes: number[];
  lapTimeHistory: number[][]; // [carIdx][sample]
  version: number; // Incremented when lapTimeHistory changes
}

interface LapTimesState {
  lapTimeBuffer: LapTimeBuffer | null;
  lapTimes: number[];
  sessionNum: number | null;
  updateLapTimes: (
    carIdxLastLapTime: number[],
    sessionNum: number | null
  ) => void;
  reset: () => void;
}

const LAP_TIME_AVG_WINDOW = 5; // Average over last 5 laps
const OUTLIER_THRESHOLD = 1.0; // Outlier detection threshold

// Helper function to calculate median
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return numbers[0];

  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}

// Helper function to calculate standard deviation
function standardDeviation(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squareDiffs = numbers.map((value) => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff =
    squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

// Helper function to filter outliers
function filterOutliers(lapTimes: number[]): number[] {
  if (lapTimes.length < 3) return lapTimes;

  const mean = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
  const stdDev = standardDeviation(lapTimes);
  const threshold = stdDev * OUTLIER_THRESHOLD;

  return lapTimes.filter((time) => Math.abs(time - mean) <= threshold);
}

export const useLapTimesStore = create<LapTimesState>((set, get) => ({
  lapTimeBuffer: null,
  lapTimes: [],
  sessionNum: null,
  updateLapTimes: (carIdxLastLapTime, sessionNum) => {
    const { lapTimeBuffer, sessionNum: prevSessionNum } = get();

    // Auto-reset only if session changed
    if (
      prevSessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== prevSessionNum
    ) {
      console.log(`[LapTimesStore] Session changed, resetting`);
      set({
        lapTimeBuffer: null,
        lapTimes: [],
        sessionNum,
      });
      return;
    }

    if (!carIdxLastLapTime.length) {
      set({ lapTimes: carIdxLastLapTime.map(() => 0) });
      return;
    }

    // Reuse existing arrays; only clone the specific sub-array that changes
    const newHistory: number[][] =
      lapTimeBuffer?.lapTimeHistory ?? carIdxLastLapTime.map(() => []);

    let historyChanged = false;

    if (
      lapTimeBuffer &&
      lapTimeBuffer.lastLapTimes.length === carIdxLastLapTime.length
    ) {
      carIdxLastLapTime.forEach((lapTime, idx) => {
        const prevLapTime = lapTimeBuffer.lastLapTimes[idx];
        // Only add to history if it's a new valid lap time
        if (lapTime > 0 && lapTime !== prevLapTime) {
          newHistory[idx] = [...(newHistory[idx] ?? []), lapTime];
          if (newHistory[idx].length > LAP_TIME_AVG_WINDOW)
            newHistory[idx] = newHistory[idx].slice(-LAP_TIME_AVG_WINDOW);
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

    // Only recalculate averages when history actually changed
    const avgLapTimes = historyChanged
      ? newHistory.map((arr) => {
          if (arr.length === 0) return 0;
          if (arr.length === 1) return arr[0];
          const filteredTimes = filterOutliers(arr);
          return median(filteredTimes);
        })
      : get().lapTimes;

    set({
      lapTimeBuffer: {
        lastLapTimes: carIdxLastLapTime,
        lapTimeHistory: newHistory,
        version: historyChanged
          ? (lapTimeBuffer?.version ?? 0) + 1
          : (lapTimeBuffer?.version ?? 0),
      },
      lapTimes: avgLapTimes,
      sessionNum,
    });
  },
  reset: () => {
    console.log('[LapTimesStore] Resetting lap time history');
    set({
      lapTimeBuffer: null,
      lapTimes: [],
      sessionNum: null,
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const useLapTimes = (): number[] =>
  useStore(useLapTimesStore, (state) => state.lapTimes);

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
 */
export const useLapTimeHistory = (): number[][] => {
  return useStore(useLapTimesStore, (state: LapTimesState) => {
    const buffer = state.lapTimeBuffer;
    if (!buffer) return EMPTY_LAP_HISTORY;

    const currentVersion = buffer.version;

    if (currentVersion === lastSeenVersion) {
      return lastSeenHistory;
    }

    lastSeenVersion = currentVersion;
    lastSeenHistory = [...buffer.lapTimeHistory]; // shallow copy for new reference
    return lastSeenHistory;
  });
};
