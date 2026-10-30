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

const LAST_LAP = 83.457;
const BEST_LAP = 82.301;
/** Demo lap length before it wraps. */
const DEMO_LAP_S = 90;
/**
 * Peak |delta| the live bar swings through. Kept under the bar's 1s full
 * scale so the hatch visibly grows and shrinks rather than sitting pinned.
 */
const DEMO_DELTA_PEAK_S = 0.85;

const HISTORY: LapEntry[] = [
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
];

/**
 * Demo snapshot at `elapsedSec` seconds into the loop.
 *
 * The current lap ticks in real time and the delta swings green↔red so the
 * live bar and predicted row both move in the editor preview.
 */
export const getDemoLapTimeLogData = (
  elapsedSec = 0
): LapTimeLogDemoData => {
  const current = elapsedSec % DEMO_LAP_S;
  // Slow sine so the bar spends time on both sides rather than flickering.
  const delta = Math.sin(elapsedSec * 0.55) * DEMO_DELTA_PEAK_S;

  return {
    current,
    lastlap: LAST_LAP,
    bestlap: BEST_LAP,
    alltimelap: 81.2,
    reference: BEST_LAP,
    delta,
    overall: 82.251,
    dirty: false,
    history: HISTORY,
  };
};
