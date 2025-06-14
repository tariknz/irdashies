import type { Telemetry } from '@irdashies/types';
import { create, useStore } from 'zustand';

export interface LapTimeBuffer {
  lastLapTimes: number[];
  lastSessionTime: number;
  lapTimeHistory: number[][]; // [carIdx][sample]
}

interface LapTimesState {
  lapTimeBuffer: LapTimeBuffer | null;
  lastLapTimeUpdate: number;
  lapTimes: number[];
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
  updateLapTimes: (telemetry) => {
    const { lapTimeBuffer, lastLapTimeUpdate } = get();
    const sessionTime = telemetry?.SessionTime?.value?.[0] ?? 0;
    
    // Check if enough simulation time has passed since last update
    if (sessionTime - lastLapTimeUpdate < LAP_TIME_UPDATE_INTERVAL) {
      return;
    }

    const carIdxLastLapTime = telemetry?.CarIdxLastLapTime?.value ?? [];
    if (!carIdxLastLapTime.length) {
      set({ lapTimes: carIdxLastLapTime.map(() => 0) });
      return;
    }

    const newHistory: number[][] = lapTimeBuffer?.lapTimeHistory
      ? lapTimeBuffer.lapTimeHistory.map(arr => [...arr])
      : carIdxLastLapTime.map(() => []);

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
        }
      });
    } else if (!lapTimeBuffer) {
      // First run: initialize history with current lap times
      carIdxLastLapTime.forEach((lapTime, idx) => {
        if (lapTime > 0) {
          newHistory[idx] = [lapTime];
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
      },
      lastLapTimeUpdate: sessionTime,
      lapTimes: avgLapTimes,
    });
  },
}));

/**
 * @returns An array of average lap times for each car in the session by index. Time value in seconds
 */
export const useLapTimes = (): number[] => useStore(useLapTimesStore, (state) => state.lapTimes); 