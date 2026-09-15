// Demo data for Lap Time Log component
export interface LapEntry {
  lap: number;
  time: number;
  delta?: number;
  dirty?: boolean;
  /** The car was in the pit lane or its box during this lap. */
  pitted?: boolean;
}

export interface LapTimeLogDemoData {
  current: number;
  lastlap: number;
  bestlap: number;
  alltimelap: number | undefined;
  reference: number;
  delta: number;
  overall: number;
  dirty: boolean;
  history: LapEntry[];
}

// Demo data for pitlane helper
export const getDemoLapTimeLogData = (): LapTimeLogDemoData => {
  return {
    current: 84.39,
    lastlap: 83.457,
    bestlap: 82.301,
    alltimelap: 81.2,
    reference: 83.457,
    delta: 0.933,
    overall: 82.251,
    dirty: false,
    history: [
      { lap: 1, time: 82.902, delta: 0.0 },
      { lap: 2, time: 83.15, delta: 0.248 },
      { lap: 3, time: 84.254, delta: 1.104 },
      { lap: 4, time: 82.301, delta: -1.953 },
      { lap: 5, time: 84.211, delta: 1.91 },
      { lap: 6, time: 85.001, delta: 0.79 },
      { lap: 7, time: 84.999, delta: -0.002, dirty: true },
      { lap: 8, time: 84.0, delta: -0.999, dirty: true },
      { lap: 9, time: 82.401, delta: -1.599 },
      { lap: 10, time: 83.457, delta: 1.056 },
      { lap: 11, time: 82.902, delta: -0.555 },
      { lap: 12, time: 83.15, delta: 0.248, dirty: true },
      { lap: 13, time: 84.254, delta: 1.104 },
      { lap: 14, time: 82.301, delta: -1.953 },
      { lap: 15, time: 84.211, delta: 1.91 },
      { lap: 16, time: 85.001, delta: 0.79, dirty: true },
      { lap: 17, time: 84.999, delta: -0.002, dirty: true },
      { lap: 18, time: 84.0, delta: -0.999, dirty: true },
      { lap: 19, time: 82.401, delta: -1.599 },
      { lap: 20, time: 83.457, delta: 1.056 },
    ],
  };
};
