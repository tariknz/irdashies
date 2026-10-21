import { useMemo, useRef } from 'react';
import {
  useLapTimeHistory,
  useStandingsSelector,
  standingsSelectors,
  useCarIdxClassEstLapTime,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { recentOfficialLapPace } from '@irdashies/domain';
import type { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useSessionLapCount } from './useSessionLapCount';

/** Default window for the class lap projection when no setting is saved. */
export const DEFAULT_ESTIMATED_LAPS_WINDOW = 5;

/** iRacing's "no limit" session time (IRSDK_UNLIMITED_TIME), one week. */
const UNLIMITED_SESSION_SECONDS = 604800;

export interface ClassLapEstimate {
  /** Furthest lap the class has on the board. */
  currentLap: number;
  /** Laps at the checkered — scheduled in a fixed-lap race, projected in a timed one. */
  total: number;
  /** True when the total is the race distance rather than a pace projection. */
  exact: boolean;
}

type ClassStandings = ReturnType<typeof useDriverStandings>;

/**
 * Per-class lap count and race-distance estimate for the class headers, keyed
 * by class id. Empty when disabled.
 */
export const useClassLapEstimates = (
  standings: ClassStandings,
  enabled: boolean,
  numLaps: number = DEFAULT_ESTIMATED_LAPS_WINDOW
): Record<string, ClassLapEstimate> => {
  const {
    isFixedLapRace,
    totalLaps,
    timeRemaining,
    timeTotal,
    state,
    sessionNum,
  } = useSessionLapCount();
  // iRacing's official lap times — the same source the session-wide lap
  // estimate in the header is built from, so a single-class race shows the
  // same projection in both places.
  const lapTimeHistory = useLapTimeHistory();
  // The leader's lap and lap distance must come from the same telemetry frame.
  // Mixed from channels ticking at different rates, the lap can tick over
  // while the distance still reads ~0.99 from the lap before, overshooting
  // the projection by a whole lap.
  const carIdxLap = useStandingsSelector(standingsSelectors.carIdxLap, {
    enabled,
  });
  const carIdxLapDistPct = useStandingsSelector(
    standingsSelectors.carIdxLapDistPct,
    { enabled }
  );
  // Last-resort pace when the leader has neither a lap in this race nor a
  // qualifying lap: iRacing's own baseline for the car/track/class, available
  // from the moment the session loads.
  const classEstLapTimes = useCarIdxClassEstLapTime();
  const lastEstimateCache = useRef<Record<string, number>>({});
  const checkeredLapsCache = useRef<Record<string, number>>({});
  const lastOverrunSeconds = useRef(0);
  const lastSessionNum = useRef<number | null>(null);

  return useMemo(() => {
    if (!enabled) return {};
    if (sessionNum !== lastSessionNum.current) {
      lastSessionNum.current = sessionNum;
      lastEstimateCache.current = {};
      checkeredLapsCache.current = {};
      lastOverrunSeconds.current = 0;
    }
    if (state < SessionState.Checkered) {
      checkeredLapsCache.current = {};
    }
    // Before the green flag iRacing's race clock isn't running: during the
    // warmup and pace lap SessionTimeRemain is unset, so the snapshot reads the
    // race as fixed-lap even when it's timed. Only a scheduled lap count
    // makes it a fixed-lap race; anything else is timed, projected from the
    // race length until the clock starts.
    const fixedLapRace = isFixedLapRace && totalLaps > 0;
    const isGreen = state >= SessionState.Racing;
    const clockRunning =
      timeRemaining > 0 && timeRemaining < UNLIMITED_SESSION_SECONDS;
    const raceLength =
      timeTotal > 0 && timeTotal < UNLIMITED_SESSION_SECONDS
        ? timeTotal
        : undefined;

    const lastEstimate = lastEstimateCache.current;
    const checkeredCache = checkeredLapsCache.current;

    // The car with the most track progress (lap + distance into it), read
    // from the same frame. Undefined when no car in the class has a lap.
    const progressLeader = <T extends { carIdx: number }>(
      classStandings: readonly T[]
    ): T | undefined => {
      let leader: T | undefined;
      let leaderProgress = 0;
      for (const standing of classStandings) {
        const lap = carIdxLap?.[standing.carIdx] ?? -1;
        if (lap <= 0) continue;
        const progress =
          lap + Math.max(0, carIdxLapDistPct?.[standing.carIdx] ?? 0);
        if (progress > leaderProgress) {
          leader = standing;
          leaderProgress = progress;
        }
      }
      return leader;
    };

    type ClassProjection =
      | { classId: string; estimate: ClassLapEstimate }
      | {
          classId: string;
          currentLap: number;
          /** Laps the class leader completes by the time the clock runs out. */
          laps: number;
          pace: number;
        };

    const projections = standings
      .map(([classId, classStandings]): ClassProjection | undefined => {
        // iRacing reports -1 for cars with no lap on the board, and the class
        // leader on results position can be one of them (garage, no time
        // set). Take the furthest lap in the class instead, so the count
        // reflects where the class actually is. From the green flag the class
        // is on lap 1, even before a rolling start brings its leader across
        // the line.
        const currentLap = classStandings.reduce(
          (furthest, standing) => Math.max(furthest, standing.lastLap ?? 0),
          isGreen ? 1 : 0
        );

        // Once the checkered flag is out the race distance is whatever the
        // leader had on the board at that moment — same as the global
        // header. Latched, because CarIdxLap can reset to 0 for cars that
        // have since left the track, and checked ahead of the fixed-lap check
        // since a race can finish either way.
        if (state >= SessionState.Checkered) {
          if (!checkeredCache[classId] && currentLap > 0) {
            checkeredCache[classId] = currentLap;
          }
          const finalLap = checkeredCache[classId] ?? currentLap;
          return {
            classId,
            estimate: { currentLap: finalLap, total: finalLap, exact: true },
          };
        }

        if (fixedLapRace) {
          return {
            classId,
            estimate: { currentLap, total: totalLaps, exact: true },
          };
        }

        // No fresh projection — hold the last one rather than dropping the
        // estimate for a frame.
        const held = lastEstimate[classId];
        const holdLastEstimate = (): ClassProjection | undefined =>
          held !== undefined
            ? {
                classId,
                estimate: { currentLap, total: held, exact: false },
              }
            : undefined;

        // Recomputed on every update rather than latched per lap, like the
        // global estimate: the official lap time lands a few ticks after the
        // leader crosses the line, so a value frozen at the crossing would
        // miss the lap just completed.
        //
        // The leader is the car furthest round the track, not the first row:
        // the row order comes from iRacing's results, which can put a car with
        // no lap on the board first (a qualifier still in the garage, a
        // leader who disconnected) until the results catch up. Projecting from
        // that car would freeze the estimate at the full-race value. Before
        // the green flag, grid positions and lap counters don't order the
        // field, so the first row (the class pole sitter) is kept there.
        const leader =
          (isGreen ? progressLeader(classStandings) : undefined) ??
          classStandings[0];
        // Pace, best source first: the leader's recent official laps; then
        // their best lap, which before the green flag is their qualifying lap
        // — close to race pace, where iRacing's class estimate runs a few
        // percent optimistic; then that class estimate.
        const pace =
          (leader
            ? recentOfficialLapPace(
                lapTimeHistory[leader.carIdx] ?? [],
                numLaps
              )
            : undefined) ??
          (leader && leader.fastestTime > 0 ? leader.fastestTime : undefined) ??
          (leader ? classEstLapTimes?.[leader.carIdx] : undefined);
        if (!pace || pace <= 0) return holdLastEstimate();

        const leaderLap = leader ? (carIdxLap?.[leader.carIdx] ?? 0) : 0;
        const leaderLapDistPct = leader
          ? (carIdxLapDistPct?.[leader.carIdx] ?? 0)
          : 0;
        if (!isGreen || leaderLap <= 0) {
          // Grid, pace lap, or a rolling start before the leader reaches the
          // line: the whole race is still ahead.
          if (raceLength === undefined) return holdLastEstimate();
          return { classId, currentLap, laps: raceLength / pace, pace };
        }
        if (!clockRunning) return holdLastEstimate();
        return {
          classId,
          currentLap,
          laps: timeRemaining / pace + (leaderLap - 1) + leaderLapDistPct,
          pace,
        };
      })
      .filter((entry): entry is ClassProjection => entry !== undefined);

    // The checkered flag goes to the overall leader on their first crossing
    // after the clock runs out; every other class then finishes on its own
    // next crossing. So the other classes race on for however long the
    // overall leader takes to finish the lap they're on at zero.
    const overallLeaderClassId = standings.find(([, classStandings]) =>
      classStandings.some((standing) => standing.position === 1)
    )?.[0];
    const overallLeader = projections.find(
      (projection) => projection.classId === overallLeaderClassId
    );
    if (overallLeader && 'laps' in overallLeader) {
      lastOverrunSeconds.current =
        (Math.ceil(overallLeader.laps) - overallLeader.laps) *
        overallLeader.pace;
    }
    const overrunSeconds = lastOverrunSeconds.current;

    return Object.fromEntries(
      projections.map((projection): [string, ClassLapEstimate] => {
        if ('estimate' in projection) {
          return [projection.classId, projection.estimate];
        }
        const { classId, currentLap, laps, pace } = projection;
        let total =
          classId === overallLeaderClassId
            ? laps
            : laps + overrunSeconds / pace;
        if (totalLaps > 0) total = Math.min(total, totalLaps);
        lastEstimate[classId] = total;
        return [classId, { currentLap, total, exact: false }];
      })
    );
  }, [
    enabled,
    sessionNum,
    isFixedLapRace,
    totalLaps,
    timeRemaining,
    timeTotal,
    state,
    standings,
    lapTimeHistory,
    numLaps,
    carIdxLap,
    carIdxLapDistPct,
    classEstLapTimes,
  ]);
};
