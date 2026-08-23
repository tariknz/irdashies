import type { LapCrossing, LapPoint } from './types';

/**
 * Shared time origin for a chart: the leader's first crossing projected back
 * to lap zero. Makes a leader running at reference pace sit flat at zero.
 */
export const traceOrigin = (
  leaderCrossings: readonly LapCrossing[],
  referenceLapSeconds: number
): number => {
  if (leaderCrossings.length === 0 || !(referenceLapSeconds > 0)) return 0;
  const first = leaderCrossings[0];
  return first.sessionTime - first.lap * referenceLapSeconds;
};

/**
 * Race trace: value = lap * referenceLapSeconds - elapsed. Higher is better.
 *
 * Every car shares one formula with no per-car term, so the difference between
 * two traces is exactly their real time difference. Pass an `originSeconds`
 * from `traceOrigin` to put the whole chart on a readable scale.
 */
export const raceTrace = (
  crossings: readonly LapCrossing[],
  referenceLapSeconds: number,
  originSeconds = 0,
  fromLap = Number.NEGATIVE_INFINITY
): LapPoint[] => {
  if (crossings.length === 0 || !(referenceLapSeconds > 0)) return [];

  const points: LapPoint[] = [];
  for (const crossing of crossings) {
    if (crossing.lap < fromLap) continue;
    points.push({
      lap: crossing.lap,
      value:
        crossing.lap * referenceLapSeconds -
        (crossing.sessionTime - originSeconds),
    });
  }
  return points;
};

/**
 * Where a race trace should start, and the time origin that puts the class
 * leader at zero there.
 *
 * The first crossing is the start-line crossing, not a completed racing lap,
 * and the lap after it carries the standing or rolling start - several seconds
 * slower than green pace. Anchoring on the start-line crossing therefore drops
 * the whole field by that one-off cost and holds it there for the rest of the
 * race, which reads as though even the leader is losing time. Anchoring on the
 * leader's first completed racing lap keeps the start out of the baseline, so
 * the leader sits near zero and every other line reads as roughly its gap to
 * the leader.
 */
export const traceAnchor = (
  leaderCrossings: readonly LapCrossing[],
  referenceLapSeconds: number
): { originSeconds: number; fromLap: number } | undefined => {
  if (leaderCrossings.length === 0 || !(referenceLapSeconds > 0)) {
    return undefined;
  }
  const anchor = leaderCrossings[1] ?? leaderCrossings[0];
  return {
    originSeconds: anchor.sessionTime - anchor.lap * referenceLapSeconds,
    fromLap: anchor.lap,
  };
};

/**
 * True gap to the class leader at equal lap count, in seconds.
 * SIGNED: negative means ahead of the nominal leader. Never Math.abs'd.
 * Only emits points for laps both cars have completed.
 */
export const gapToClassLeader = (
  crossings: readonly LapCrossing[],
  leaderCrossings: readonly LapCrossing[]
): LapPoint[] => {
  if (crossings.length === 0 || leaderCrossings.length === 0) return [];

  const leaderTimeByLap = new Map<number, number>();
  for (const crossing of leaderCrossings) {
    leaderTimeByLap.set(crossing.lap, crossing.sessionTime);
  }

  const points: LapPoint[] = [];
  for (const crossing of crossings) {
    const leaderTime = leaderTimeByLap.get(crossing.lap);
    if (leaderTime === undefined) continue;
    points.push({
      lap: crossing.lap,
      value: crossing.sessionTime - leaderTime,
    });
  }

  return points;
};

/** In-class position at each recorded lap. */
export const positionByLap = (
  crossings: readonly LapCrossing[]
): LapPoint[] => {
  const points: LapPoint[] = [];

  for (const crossing of crossings) {
    // The processor records 0 when the position was unknown at the crossing.
    if (crossing.classPosition <= 0) continue;
    points.push({ lap: crossing.lap, value: crossing.classPosition });
  }

  return points;
};
