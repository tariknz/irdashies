export interface TimingDataPoint {
  dist: number; // CarIdxLapDistPct value (0.0 - 1.0)
  time: number; // SessionTime when car was at this position
}

export interface CarClassTimingData {
  carClassId: number;
  lapTime: number; // Total lap time in seconds
  items: TimingDataPoint[]; // Sorted array of timing points
  sessionNum: number; // Session number when this was recorded
  trackId: number; // Track ID for this timing data
}

export interface CarRecordingState {
  carIdx: number;
  currentLap: number;
  lastDist: number;
  lastTime: number;
  timingPoints: TimingDataPoint[];
  carClassId: number;
  isLapStarted: boolean;
  isRecording: boolean;
}

export interface TimingInterpolationStore {
  // Best lap data by car class ID
  bestLapByCarClass: Map<number, CarClassTimingData>;
  
  // Get interpolated time at specific distance for a car class
  getTimeByDistance: (carClassId: number, dist: number) => number | null;
  
  // Calculate time delta between two positions using interpolation
  getTimeDelta: (
    playerCarIdx: number,
    otherCarIdx: number,
    playerDist: number,
    otherDist: number,
    drivers: { carIdx: number; carClass?: { id?: number; estLapTime?: number } }[]
  ) => number | null;
  
  // Clear all timing data (e.g., when session changes)
  clearTimingData: () => void;
  
  // Get current recording state
  isRecording: boolean;
  
  // Statistics
  getStats: () => {
    totalCarClasses: number;
    bestLapTimes: Record<number, number>;
    dataPoints: Record<number, number>;
  };
}
