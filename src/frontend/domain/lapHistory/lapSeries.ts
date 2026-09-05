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

/**
 * Position at the end of each lap for a whole field, derived from the order
 * cars crossed the line rather than from `classPosition`.
 *
 * `CarIdxClassPosition` cannot be trusted: iRacing leaves it at 0 for most
 * crossings — 81% of them in a measured 20-lap race, and every crossing after
 * lap 6 — which truncated the chart at the last lap it happened to populate.
 * `lap` and `sessionTime` are always recorded, so rank on those instead.
 *
 * Ranking by crossing time is exact, lapped cars included: if another car
 * completed the same lap earlier it is ahead, whether it is on this lap or
 * several ahead. Cars that never completed a lap simply have no point for it.
 *
 * Pass one class's crossings to get class position; pass the field to get
 * overall position.
 */
export const positionsByLap = (
  crossingsByCar: ReadonlyMap<number, readonly LapCrossing[]>
): Map<number, LapPoint[]> => {
  // lap -> [carIdx, earliest sessionTime on that lap]
  const byLap = new Map<number, { carIdx: number; sessionTime: number }[]>();

  for (const [carIdx, crossings] of crossingsByCar) {
    const earliest = new Map<number, number>();
    for (const crossing of crossings) {
      if (!(crossing.sessionTime > 0)) continue;
      const seen = earliest.get(crossing.lap);
      // A lap can be recorded twice (a tow or reset re-baselines the car).
      // The first crossing is the one that decides track order.
      if (seen === undefined || crossing.sessionTime < seen) {
        earliest.set(crossing.lap, crossing.sessionTime);
      }
    }
    for (const [lap, sessionTime] of earliest) {
      const entries = byLap.get(lap);
      if (entries) entries.push({ carIdx, sessionTime });
      else byLap.set(lap, [{ carIdx, sessionTime }]);
    }
  }

  const points = new Map<number, LapPoint[]>();
  for (const [lap, entries] of byLap) {
    entries.sort((a, b) => a.sessionTime - b.sessionTime);
    entries.forEach((entry, index) => {
      const existing = points.get(entry.carIdx);
      const point = { lap, value: index + 1 };
      if (existing) existing.push(point);
      else points.set(entry.carIdx, [point]);
    });
  }

  // The map is filled lap-group by lap-group, so each car's points arrive out
  // of order. Everything downstream assumes lap-ordered points.
  for (const carPoints of points.values()) {
    carPoints.sort((a, b) => a.lap - b.lap);
  }

  return points;
};
