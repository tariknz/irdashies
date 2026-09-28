import type { LapCrossing, LapPoint } from './types';

/** Green laps needed before a median is more representative than a best lap. */
const MIN_GREEN_LAPS = 3;

/** Lap time for each lap, as the first difference of crossing times. */
export const lapTimes = (crossings: readonly LapCrossing[]): LapPoint[] => {
  const points: LapPoint[] = [];

  for (let i = 1; i < crossings.length; i += 1) {
    const previous = crossings[i - 1];
    const current = crossings[i];
    // A gap in the lap numbers means a crossing is missing, so the difference
    // would span more than one lap.
    if (current.lap !== previous.lap + 1) continue;
    points.push({
      lap: current.lap,
      value: current.sessionTime - previous.sessionTime,
    });
  }

  return points;
};

/**
 * Lap times for laps run under green: neither the crossing that ends the lap
 * nor the one that starts it is flagged. A pit stop costs time on both sides
 * of the line, so both the in-lap and the out-lap are excluded.
 *
 * `skipOpening` drops the first racing lap, which carries the standing or
 * rolling start and is never representative of green pace.
 */
export const greenLapTimes = (
  crossings: readonly LapCrossing[],
  skipOpening = false
): number[] => {
  const times: number[] = [];
  const openingLap = crossings.length > 0 ? crossings[0].lap + 1 : 0;

  for (let i = 1; i < crossings.length; i += 1) {
    const previous = crossings[i - 1];
    const current = crossings[i];
    if (current.lap !== previous.lap + 1) continue;
    if (skipOpening && current.lap === openingLap) continue;
    if (previous.inPit || previous.offTrack) continue;
    if (current.inPit || current.offTrack) continue;
    const seconds = current.sessionTime - previous.sessionTime;
    if (seconds > 0) times.push(seconds);
  }

  return times;
};

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Median of the green laps (not inPit, not offTrack). Undefined if too few. */
export const medianGreenLapTime = (
  crossings: readonly LapCrossing[]
): number | undefined => {
  const times = greenLapTimes(crossings);
  if (times.length < MIN_GREEN_LAPS) return undefined;
  return median(times);
};

/**
 * Median pace from the most recent `numLaps` green laps (neither the crossing
 * that ends nor the one that starts a lap is flagged, so pit in/out laps never
 * enter the average). Windows to the tail of the green-lap list so the pace
 * tracks a driver's current pace rather than their whole-race average.
 * Undefined until at least one green lap has been set.
 */
export const recentGreenLapPace = (
  crossings: readonly LapCrossing[],
  numLaps: number
): number | undefined => {
  const green = greenLapTimes(crossings);
  if (green.length === 0) return undefined;
  return median(green.slice(-Math.max(1, numLaps)));
};

/**
 * Reference pace for a class. Median of the leader's green laps once there are
 * at least 3, otherwise their fastest lap so far. `source` tells the caller
 * which, so the axis can say so.
 *
 * The opening racing lap is excluded from the median: it carries the start and
 * runs several seconds slow. Once the field is short of green laps the
 * fallbacks widen rather than leave the chart with no reference at all.
 */
export const classReferenceLap = (
  leaderCrossings: readonly LapCrossing[]
): { seconds: number; source: 'median' | 'fastest' } | undefined => {
  const settled = greenLapTimes(leaderCrossings, true);
  if (settled.length >= MIN_GREEN_LAPS) {
    return { seconds: median(settled), source: 'median' };
  }
  const green = greenLapTimes(leaderCrossings);
  if (green.length > 0) {
    return { seconds: Math.min(...green), source: 'fastest' };
  }

  // Every lap so far was a pit or off-track lap. A slow reference still beats
  // no chart at all.
  const all = lapTimes(leaderCrossings)
    .map((point) => point.value)
    .filter((seconds) => seconds > 0);
  if (all.length === 0) return undefined;
  return { seconds: Math.min(...all), source: 'fastest' };
};
