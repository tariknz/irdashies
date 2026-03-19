// Demo data for Lap Time Log component
export interface LapEntry {
  lap: number;
  time: number;
  delta?: number;
  dirty?: boolean;
}

export interface LapTimeLogDemoData {
  current: number;
  lastlap: number;
  bestlap: number;
  reference: number;
  delta: number;
  overall: number;
  dirty: boolean;
  history: LapEntry[];
}

// Demo data for pitlane helper
export const getDemoLapTimeLogData = (): LapTimeLogDemoData => {
  return {    
    "current": 84.010,
    "lastlap": 85.249,
    "bestlap": 82.401,
    "reference": 82.401,
    "delta": 2.60,
    "overall": 82.301,
    "dirty": false,
    "history": [
      { "lap": 1, "time": 82.401, "delta": 0 },
      { "lap": 2, "time": 83.150, "delta": 0.749 },
      { "lap": 3, "time": 84.254, "delta": 1.853 },
      { "lap": 4, "time": 84.541, "delta": 2.140},
      { "lap": 5, "time": 84.211, "delta": 1.810 },
      { "lap": 6, "time": 85.001, "delta": 2.600 },
      { "lap": 7, "time": 84.999, "delta": 2.598, "dirty": true },
      { "lap": 8, "time": 84.000, "delta": 1.599, "dirty": true },
      { "lap": 9, "time": 83.123, "delta": 0.722 },
      { "lap": 10, "time": 83.457, "delta": 1.056 }
    ]
};
};
