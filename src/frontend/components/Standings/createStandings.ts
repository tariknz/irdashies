import { SessionResults, Driver, TrackLocation } from '@irdashies/types';
import {
  calculateIRatingGain,
  RaceResult,
  CalculationResult,
} from '@irdashies/utils/iratingGain';
import { GlobalFlags } from '@irdashies/types';
import { useReferenceLapStore } from '@irdashies/context';
import {
  calculateClassEstimatedGap,
  calculateReferenceGap,
  getStats,
} from './relativeGapHelpers';

export type LastTimeState = 'session-fastest' | 'personal-best' | undefined;

export interface Gap {
  value: number | undefined;
  laps: number;
}

export interface Standings {
  carIdx: number;
  position?: number;
  classPosition?: number;
  lap?: number;
  lappedState?: 'ahead' | 'behind' | 'same';
  delta?: number;
  gap?: Gap;
  interval?: number;
  isPlayer: boolean;
  driver: {
    name: string;
    carNum: string;
    license: string;
    rating: number;
    flairId?: number;
    teamName?: string;
  };
  fastestTime: number;
  hasFastestTime: boolean;
  lastTime: number;
  lastTimeState?: LastTimeState;
  onPitRoad: boolean;
  tireCompound: number;
  onTrack: boolean;
  carClass: {
    id: number;
    color: number;
    name: string;
    relativeSpeed: number;
    estLapTime: number;
  };
  radioActive?: boolean;
  iratingChange?: number;
  carId?: number;
  lapTimeDeltas?: number[]; // Array of deltas vs player's recent laps, most recent last
  lastPitLap?: number;
  lastLap?: number;
  prevCarTrackSurface?: number;
  carTrackSurface?: number;
  currentSessionType?: string;
  dnf: boolean;
  repair: boolean;
  penalty: boolean;
  slowdown: boolean;
  relativePct: number;
  positionChange?: number;
}

const calculateDelta = (
  carIdx: number,
  carFastestTime: number,
  carIdxF2Time: number[], // map of car index and race time behind leader
  sessionType: string | undefined,
  leaderFastestTime: number | undefined
): number | undefined => {
  // race delta
  if (sessionType === 'Race') {
    return carIdxF2Time?.[carIdx];
  }

  // non-race delta
  let delta = leaderFastestTime
    ? carFastestTime - leaderFastestTime
    : undefined;

  // if delta is negative, set it to undefined then hide from UI
  if (delta && delta <= 0) delta = undefined;

  return delta;
};

const getLastTimeState = (
  lastTime: number | undefined,
  fastestTime: number | undefined,
  hasFastestTime: boolean
): LastTimeState => {
  if (
    lastTime !== undefined &&
    fastestTime !== undefined &&
    lastTime === fastestTime
  ) {
    return hasFastestTime ? 'session-fastest' : 'personal-best';
  }
  return undefined;
};

/**
 * This method will create the driver standings for the current session
 * It will calculate the delta to the leader
 * It will also determine if the driver has the fastest time
 */
export const createDriverStandings = (
  session: {
    playerIdx?: number;
    drivers?: Driver[];
    qualifyingResults?: SessionResults[];
  },
  telemetry: {
    carIdxF2TimeValue?: number[];
    carIdxOnPitRoadValue?: boolean[];
    carIdxTrackSurfaceValue?: TrackLocation[];
    radioTransmitCarIdx?: number[];
    carIdxTireCompoundValue?: number[];
    isOnTrack?: boolean;
    carIdxSessionFlags?: number[];
  },
  currentSession: {
    resultsPositions?: SessionResults[];
    resultsFastestLap?: {
      CarIdx: number;
      FastestLap: number;
      FastestTime: number;
    }[];
    sessionType?: string;
  },
  lastPitLap: number[],
  lastLap: number[],
  prevCarTrackSurface: TrackLocation[],
  numLapsToShow?: number,
  lapDeltasVsPlayer?: number[][] // NEW: Pre-calculated deltas from LapTimesStore
): Standings[] => {
  const resultsPositions = Array.isArray(currentSession.resultsPositions)
    ? currentSession.resultsPositions
    : [];
  const qualifyingResults = Array.isArray(session.qualifyingResults)
    ? session.qualifyingResults
    : [];
  const results =
    resultsPositions.length > 0 ? resultsPositions : qualifyingResults;

  // When no results exist yet (e.g. race warmup before any laps), build
  // standings from the full driver list so all drivers are visible immediately.
  if (results.length === 0 && session.drivers) {
    return session.drivers
      .filter((driver) => !driver.CarIsPaceCar && !driver.IsSpectator)
      .sort((a, b) => {
        const numA = parseInt(a.CarNumber, 10);
        const numB = parseInt(b.CarNumber, 10);
        if (isNaN(numA) && isNaN(numB))
          return a.CarNumber.localeCompare(b.CarNumber);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      })
      .map((driver, index) => ({
        carIdx: driver.CarIdx,
        position: index + 1,
        classPosition: index + 1, // temporary until real positions are available
        isPlayer: driver.CarIdx === session.playerIdx,
        driver: {
          name: driver.UserName,
          carNum: driver.CarNumber,
          license: driver.LicString,
          rating: driver.IRating,
          flairId: driver.FlairID,
          teamName: driver.TeamName,
        },
        fastestTime: -1,
        hasFastestTime: false,
        lastTime: -1,
        lastTimeState: undefined as LastTimeState,
        onPitRoad: telemetry?.carIdxOnPitRoadValue?.[driver.CarIdx] ?? false,
        onTrack:
          (telemetry?.carIdxTrackSurfaceValue?.[driver.CarIdx] ?? -1) > -1,
        tireCompound: telemetry?.carIdxTireCompoundValue?.[driver.CarIdx] ?? 0,
        carClass: {
          id: driver.CarClassID,
          color: driver.CarClassColor,
          name: driver.CarClassShortName,
          relativeSpeed: driver.CarClassRelSpeed,
          estLapTime: driver.CarClassEstLapTime,
        },
        radioActive: telemetry.radioTransmitCarIdx?.includes(driver.CarIdx),
        carId: driver.CarID,
        lapTimeDeltas: undefined,
        lastPitLap: lastPitLap[driver.CarIdx] ?? undefined,
        lastLap: lastLap[driver.CarIdx] ?? undefined,
        prevCarTrackSurface: prevCarTrackSurface[driver.CarIdx] ?? undefined,
        carTrackSurface:
          telemetry?.carIdxTrackSurfaceValue?.[driver.CarIdx] ?? undefined,
        currentSessionType: currentSession.sessionType,
        dnf: false,
        repair: false,
        penalty: false,
        slowdown: false,
        relativePct: 0,
      }));
  }

  // Build a per-class fastest time map for qualifying/practice delta calculations.
  // resultsFastestLap is session-wide only (no class info), so we derive class
  // leaders from results + driver class info instead.
  const classFastestTimeMap = new Map<number, number>();
  results.forEach((result) => {
    if (result.FastestTime <= 0) return;
    const driver = session.drivers?.find((d) => d.CarIdx === result.CarIdx);
    if (!driver) return;
    const classId = driver.CarClassID;
    const current = classFastestTimeMap.get(classId);
    if (current === undefined || result.FastestTime < current) {
      classFastestTimeMap.set(classId, result.FastestTime);
    }
  });

  // Per-class fastest car index map for hasFastestTime
  const classFastestCarIdxMap = new Map<number, number>();
  results.forEach((result) => {
    if (result.FastestTime <= 0) return;
    const driver = session.drivers?.find((d) => d.CarIdx === result.CarIdx);
    if (!driver) return;
    const classId = driver.CarClassID;
    const classBest = classFastestTimeMap.get(classId);
    if (result.FastestTime === classBest) {
      if (!classFastestCarIdxMap.has(classId)) {
        classFastestCarIdxMap.set(classId, result.CarIdx);
      }
    }
  });

  const sortByCarNumber = (a: Driver, b: Driver) => {
    const numA = parseInt(a.CarNumber, 10);
    const numB = parseInt(b.CarNumber, 10);
    if (isNaN(numA) && isNaN(numB))
      return a.CarNumber.localeCompare(b.CarNumber);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  };

  const mapped = results
    .map((result) => {
      const driver = session.drivers?.find(
        (driver) => driver.CarIdx === result.CarIdx
      );

      if (!driver) return null;
      const classLeaderFastestTime = classFastestTimeMap.get(driver.CarClassID);
      const classFastestCarIdx = classFastestCarIdxMap.get(driver.CarClassID);
      const isClassFastest = result.CarIdx === classFastestCarIdx;
      return {
        carIdx: result.CarIdx,
        position: result.Position,
        classPosition: result.ClassPosition + 1,
        delta: calculateDelta(
          result.CarIdx,
          result.FastestTime,
          telemetry.carIdxF2TimeValue ?? [],
          currentSession?.sessionType,
          classLeaderFastestTime
        ),
        isPlayer: result.CarIdx === session.playerIdx,
        driver: {
          name: driver.UserName,
          carNum: driver.CarNumber,
          license: driver.LicString,
          rating: driver.IRating,
          flairId: driver.FlairID,
          teamName: driver.TeamName,
        },
        fastestTime: result.FastestTime,
        hasFastestTime: isClassFastest,
        lastTime: result.LastTime,
        lastTimeState: getLastTimeState(
          result.LastTime,
          result.FastestTime,
          isClassFastest
        ),
        onPitRoad: telemetry?.carIdxOnPitRoadValue?.[result.CarIdx] ?? false,
        onTrack:
          (telemetry?.carIdxTrackSurfaceValue?.[result.CarIdx] ??
            TrackLocation.NotInWorld) > TrackLocation.NotInWorld,
        tireCompound: telemetry?.carIdxTireCompoundValue?.[result.CarIdx] ?? 0,
        carClass: {
          id: driver.CarClassID,
          color: driver.CarClassColor,
          name: driver.CarClassShortName,
          relativeSpeed: driver.CarClassRelSpeed,
          estLapTime: driver.CarClassEstLapTime,
        },
        radioActive: telemetry.radioTransmitCarIdx?.includes(result.CarIdx),
        carId: driver.CarID,
        lapTimeDeltas:
          result.CarIdx === session.playerIdx
            ? undefined // Don't show deltas for player (comparing to themselves)
            : lapDeltasVsPlayer &&
                lapDeltasVsPlayer[result.CarIdx] &&
                lapDeltasVsPlayer[result.CarIdx].length > 0
              ? lapDeltasVsPlayer[result.CarIdx].slice(
                  -(numLapsToShow ?? lapDeltasVsPlayer[result.CarIdx].length)
                ) // Use most recent laps
              : undefined,
        lastPitLap: lastPitLap[result.CarIdx] ?? undefined,
        lastLap: lastLap[result.CarIdx] ?? undefined,
        prevCarTrackSurface: prevCarTrackSurface[result.CarIdx] ?? undefined,
        carTrackSurface:
          telemetry?.carIdxTrackSurfaceValue?.[result.CarIdx] ?? undefined,
        currentSessionType: currentSession.sessionType,
        dnf: !!(
          (telemetry?.carIdxSessionFlags?.[result.CarIdx] ?? 0) &
          GlobalFlags.Disqualify
        ),
        repair: !!(
          (telemetry?.carIdxSessionFlags?.[result.CarIdx] ?? 0) &
          GlobalFlags.Repair
        ),
        penalty: !!(
          (telemetry?.carIdxSessionFlags?.[result.CarIdx] ?? 0) &
          GlobalFlags.Black
        ),
        slowdown: !!(
          (telemetry?.carIdxSessionFlags?.[result.CarIdx] ?? 0) &
          GlobalFlags.Furled
        ),
        relativePct: 0,
      };
    })
    .filter((s) => !!s);

  // In practice/warmup sessions, drivers only appear in resultsPositions once
  // they complete a lap. Drivers yet to set a time won't be in results at all.
  // Keep them visible at the bottom, sorted by car number.
  const mappedCarIdxs = new Set(mapped.map((s) => s.carIdx));

  // Build per-class position counts from drivers who have completed laps
  const classPositionCounts = new Map<number, number>();
  mapped.forEach((standing) => {
    const classId = standing.carClass.id;
    classPositionCounts.set(
      classId,
      (classPositionCounts.get(classId) ?? 0) + 1
    );
  });

  const notYetInResults = (session.drivers ?? [])
    .filter(
      (driver) =>
        !driver.CarIsPaceCar &&
        !driver.IsSpectator &&
        !mappedCarIdxs.has(driver.CarIdx)
    )
    .sort(sortByCarNumber)
    .map((driver, index) => {
      // Assign per-class position: count of drivers in their class + 1
      const classId = driver.CarClassID;
      const classPosition = (classPositionCounts.get(classId) ?? 0) + 1;
      classPositionCounts.set(classId, classPosition);

      return {
        carIdx: driver.CarIdx,
        position: mapped.length + index + 1,
        classPosition,
        isPlayer: driver.CarIdx === session.playerIdx,
        driver: {
          name: driver.UserName,
          carNum: driver.CarNumber,
          license: driver.LicString,
          rating: driver.IRating,
          flairId: driver.FlairID,
          teamName: driver.TeamName,
        },
        fastestTime: -1,
        hasFastestTime: false,
        lastTime: -1,
        lastTimeState: undefined as LastTimeState,
        onPitRoad: telemetry?.carIdxOnPitRoadValue?.[driver.CarIdx] ?? false,
        onTrack:
          (telemetry?.carIdxTrackSurfaceValue?.[driver.CarIdx] ??
            TrackLocation.NotInWorld) > TrackLocation.NotInWorld,
        tireCompound: telemetry?.carIdxTireCompoundValue?.[driver.CarIdx] ?? 0,
        carClass: {
          id: driver.CarClassID,
          color: driver.CarClassColor,
          name: driver.CarClassShortName,
          relativeSpeed: driver.CarClassRelSpeed,
          estLapTime: driver.CarClassEstLapTime,
        },
        radioActive: telemetry.radioTransmitCarIdx?.includes(driver.CarIdx),
        carId: driver.CarID,
        lapTimeDeltas: undefined,
        lastPitLap: lastPitLap[driver.CarIdx] ?? undefined,
        lastLap: lastLap[driver.CarIdx] ?? undefined,
        prevCarTrackSurface: prevCarTrackSurface[driver.CarIdx] ?? undefined,
        carTrackSurface:
          telemetry?.carIdxTrackSurfaceValue?.[driver.CarIdx] ?? undefined,
        currentSessionType: currentSession.sessionType,
        dnf: false,
        repair: false,
        penalty: false,
        slowdown: false,
        relativePct: 0,
      };
    });

  return [...mapped, ...notYetInResults];
};

/**
 * This method will group the standings by class and sort them by relative speed
 */
export const groupStandingsByClass = (standings: Standings[]) => {
  // group by class
  const groupedStandings = standings.reduce(
    (acc, result) => {
      if (!result.carClass) return acc;
      if (!acc[result.carClass.id]) {
        acc[result.carClass.id] = [];
      }
      acc[result.carClass.id].push(result);
      return acc;
    },
    {} as Record<number, typeof standings>
  );

  // sort class by relative speed
  const sorted = Object.entries(groupedStandings).sort(
    ([, a], [, b]) => b[0].carClass.relativeSpeed - a[0].carClass.relativeSpeed
  );
  return sorted;
};

/**
 * This method will augment the standings with iRating changes
 */
export const augmentStandingsWithIRating = (
  groupedStandings: [string, Standings[]][]
): [string, Standings[]][] => {
  return groupedStandings.map(([classId, classStandings]) => {
    const raceResultsInput: RaceResult<number>[] = classStandings
      .filter((s) => !!s.classPosition) // Only include drivers with a class position, should not happen in races
      .map((driverStanding) => ({
        driver: driverStanding.carIdx,
        finishRank: driverStanding.classPosition ?? 0,
        startIRating: driverStanding.driver.rating,
        started: true, // This is a critical assumption.
      }));

    if (raceResultsInput.length === 0) {
      return [classId, classStandings];
    }

    const iratingCalculationResults = calculateIRatingGain(raceResultsInput);

    const iratingChangeMap = new Map<number, number>();
    iratingCalculationResults.forEach(
      (calcResult: CalculationResult<number>) => {
        iratingChangeMap.set(
          calcResult.raceResult.driver,
          calcResult.iratingChange
        );
      }
    );

    const augmentedClassStandings = classStandings.map((driverStanding) => ({
      ...driverStanding,
      iratingChange: iratingChangeMap.get(driverStanding.carIdx),
    }));
    return [classId, augmentedClassStandings];
  });
};

/**
 * This method will augment the standings with gap calculations to class leader
 * Gap = driver_delta - class_leader_delta (both relative to session leader)
 */
export const augmentStandingsWithGap = (
  groupedStandings: [string, Standings[]][],
  carIdxLap: number[],
  carIdxLapDistPct: number[],
  carIdxOnPitRoad: boolean[],
  carIdxEstTime: number[],
  useLivePositionStandings: boolean,
  sessionType?: string
): [string, Standings[]][] => {
  const isRace = sessionType === 'Race';

  return groupedStandings.map(([classId, classStandings]) => {
    // Find class leader (lowest class position)
    const classLeader = classStandings[0];
    if (!classLeader) {
      return [classId, classStandings];
    }
    // In race sessions, bail early if the class leader has no delta (no data yet).
    // In qualifying/practice, the class leader always has undefined delta (they're
    // the fastest), so we must not bail — gap for other cars uses their own delta.
    if (isRace && classLeader.delta === undefined) {
      return [classId, classStandings];
    }

    // Calculate gap for each driver: gap = driver_delta - class_leader_delta
    const augmentedClassStandings = classStandings.map((driverStanding) => {
      // Class leader always shows as dash (undefined gap)
      if (driverStanding.carIdx === classLeader.carIdx) {
        return { ...driverStanding, gap: { value: undefined, laps: 0 } };
      }

      // For race sessions, require both drivers to be on track for live gap
      if (isRace && (!classLeader.onTrack || !driverStanding.onTrack)) {
        return { ...driverStanding, gap: { value: undefined, laps: 0 } };
      }

      let gapValue: number | undefined;

      if (isRace) {
        // Race gap: use live position or delta-based calculation
        const classLeaderTrackPct = carIdxLapDistPct[classLeader.carIdx];
        const driverIdx = driverStanding.carIdx;
        const driverTrackPct = carIdxLapDistPct[driverIdx];

        if (
          useLivePositionStandings &&
          classLeaderTrackPct > -1 &&
          driverTrackPct > -1
        ) {
          const driverClassId = driverStanding.carClass.id;
          const isStartingLap = (driverStanding?.lap ?? -1) <= 1;

          const refLap = useReferenceLapStore
            .getState()
            .getReferenceLap(driverIdx, driverClassId, isStartingLap);

          const isOnPitRoadAhead = carIdxOnPitRoad[classLeader.carIdx];
          const isOnPitRoadBehind = carIdxOnPitRoad[driverIdx];
          const isOnPitOrHasNoData =
            isOnPitRoadAhead || isOnPitRoadBehind || refLap.finishTime < 0;

          if (isOnPitOrHasNoData) {
            const classLeaderEstTime = carIdxEstTime[classLeader.carIdx];
            const behindEstTime = carIdxEstTime[driverIdx];
            const driverStats = getStats(behindEstTime, driverStanding);

            gapValue = calculateClassEstimatedGap(
              getStats(classLeaderEstTime, classLeader),
              driverStats
            );
          } else {
            gapValue = calculateReferenceGap(
              refLap,
              classLeaderTrackPct,
              driverTrackPct
            );
          }
        } else {
          gapValue =
            driverStanding.delta !== undefined &&
            classLeader.delta !== undefined
              ? driverStanding.delta - classLeader.delta
              : undefined;
        }

        const classLeaderTrackPctForLaps = carIdxLapDistPct[classLeader.carIdx];
        const driverLapNumber = carIdxLap[driverStanding.carIdx];
        const classLeaderLapNumber = carIdxLap[classLeader.carIdx];

        const gap = {
          value: gapValue ? Math.abs(gapValue) : undefined,
          // NOTE: iRacing shows laps behind as a negative number
          laps: -Math.floor(
            classLeaderLapNumber +
              classLeaderTrackPctForLaps -
              (driverLapNumber + carIdxLapDistPct[driverStanding.carIdx])
          ),
        };

        return { ...driverStanding, gap };
      } else {
        // Practice/Qualifying: gap is purely based on fastest-lap-time delta.
        // driver.delta = driverFastest - leaderFastest (classLeader.delta = 0)
        // onTrack is not required — drivers are often in pits after their hot lap.
        gapValue =
          driverStanding.delta !== undefined ? driverStanding.delta : undefined;

        const gap = {
          value: gapValue !== undefined ? Math.abs(gapValue) : undefined,
          laps: 0,
        };

        return { ...driverStanding, gap };
      }
    });

    return [classId, augmentedClassStandings];
  });
};

/**
 * This method will augment the standings with interval calculations to player
 * Interval shows time gaps between consecutive cars, calculated by subtracting gaps
 * For each driver, interval = gap_of_driver_behind - gap_of_current_driver
 * Player shows as undefined (no interval)
 */
export const augmentStandingsWithInterval = (
  groupedStandings: [string, Standings[]][]
): [string, Standings[]][] => {
  return groupedStandings.map(([classId, classStandings]) => {
    // Sort drivers by their gap values (ascending - smallest gaps first = closest to leader)
    const augmentedClassStandings = classStandings.map(
      (driverStanding, index) => {
        // The driver physically in front of this one in the standings
        const driverAhead = classStandings[index - 1];

        let interval: number | undefined = undefined;

        // If there's no one ahead (P1 in class), the interval is typically undefined or 0
        if (!driverAhead) {
          interval = undefined;
        }
        // If the car ahead is the leader (who has no gap value),
        // the interval for P2 is simply their own gap to the leader.
        // For race sessions, onTrack is still required.
        else if (driverAhead.gap?.value === undefined) {
          const isRace = driverStanding.currentSessionType === 'Race';
          if (!isRace || driverStanding.onTrack) {
            interval = driverStanding.gap?.value;
          }
        }
        // Standard case: Interval = Current Driver's Gap - Driver Ahead's Gap
        // onTrack is only required for race sessions — in practice/qualifying
        // gaps are based on static fastest-lap times so onTrack doesn't matter.
        else if (
          driverStanding.gap?.value !== undefined &&
          (driverStanding.currentSessionType !== 'Race' ||
            driverStanding.onTrack)
        ) {
          // We use Math.abs to handle edge cases where deltas and positions
          // are slightly out of sync in a telemetry frame.
          interval = Math.abs(driverStanding.gap.value - driverAhead.gap.value);
        }

        return {
          ...driverStanding,
          interval,
        };
      }
    );

    return [classId, augmentedClassStandings];
  });
};

/**
 * This method will slice up the standings and return only the relevant drivers
 * Top 3 drivers are always included for each class
 * Within the player's class it will include the player and 5 drivers before and after
 *
 * @param groupedStandings - The grouped standings to slice
 * @param driverClass - The class of the player
 * @param options.buffer - The number of drivers to include before and after the player
 * @param options.numNonClassDrivers - The number of drivers to include in classes outside of the player's class
 * @param options.minPlayerClassDrivers - The minimum number of drivers to include in the player's class
 * @param options.numTopDrivers - The number of top drivers to always include in the player's class
 * @returns The sliced standings
 */
export const sliceRelevantDrivers = <T extends { isPlayer?: boolean }>(
  groupedStandings: [string, T[]][],
  driverClass: string | number | undefined,
  {
    buffer = 3,
    numNonClassDrivers = 3,
    minPlayerClassDrivers = 10,
    numTopDrivers = 3,
  } = {}
): [string, T[]][] => {
  return groupedStandings.map(([classIdx, standings]) => {
    const playerIndex = standings.findIndex((driver) => driver.isPlayer);
    if (String(driverClass) !== classIdx) {
      // if player is not in this class, return only top N drivers in that class
      return [classIdx, standings.slice(0, numNonClassDrivers)];
    }

    // if there are less than minPlayerClassDrivers drivers, return all of them
    if (standings.length <= minPlayerClassDrivers) {
      return [classIdx, standings];
    }

    // when no player is found, just return the top `minPlayerClassDrivers`
    if (playerIndex === -1) {
      return [classIdx, standings.slice(0, minPlayerClassDrivers)];
    }

    const relevantDrivers = new Set<T>();

    // Add top drivers
    for (let i = 0; i < numTopDrivers; i++) {
      if (standings[i]) {
        relevantDrivers.add(standings[i]);
      }
    }

    // Add drivers around the player
    const start = Math.max(0, playerIndex - buffer);
    const end = Math.min(standings.length, playerIndex + buffer + 1);
    for (let i = start; i < end; i++) {
      if (standings[i]) {
        relevantDrivers.add(standings[i]);
      }
    }

    // Ensure we have at least `minPlayerClassDrivers` by expanding from both ends of the buffer range
    let expandBefore = start - 1;
    let expandAfter = end;
    while (relevantDrivers.size < minPlayerClassDrivers) {
      let added = false;

      // Try to add from before the buffer range
      if (expandBefore >= 0 && standings[expandBefore]) {
        relevantDrivers.add(standings[expandBefore]);
        expandBefore--;
        added = true;
      }

      // Try to add from after the buffer range
      if (expandAfter < standings.length && standings[expandAfter]) {
        relevantDrivers.add(standings[expandAfter]);
        expandAfter++;
        added = true;
      }

      // If we couldn't add in either direction, we're done
      if (!added) break;
    }

    const sortedDrivers = standings.filter((driver) =>
      relevantDrivers.has(driver)
    );

    return [classIdx, sortedDrivers];
  });
};

/**
 * Augments standings with the number of positions gained or lost compared to
 * the driver's qualifying grid position. Positive = gained positions,
 * negative = lost positions. Only meaningful for race sessions.
 */
export const augmentStandingsWithPositionChange = (
  groupedStandings: [string, Standings[]][],
  qualifyingResults: SessionResults[] | undefined
): [string, Standings[]][] => {
  if (!qualifyingResults || qualifyingResults.length === 0) {
    return groupedStandings;
  }

  // Build a map of carIdx -> qualifying class position (1-based)
  const qualifyingClassPositionByCarIdx = new Map<number, number>();
  qualifyingResults.forEach((result) => {
    qualifyingClassPositionByCarIdx.set(
      result.CarIdx,
      result.ClassPosition + 1
    );
  });

  return groupedStandings.map(([classId, classStandings]) => {
    const augmented = classStandings.map((standing) => {
      const qualifyingClassPos = qualifyingClassPositionByCarIdx.get(
        standing.carIdx
      );
      if (
        qualifyingClassPos === undefined ||
        standing.classPosition === undefined
      ) {
        return standing;
      }
      // Positive = moved up (e.g. started P5, now P3 → +2)
      const positionChange = qualifyingClassPos - standing.classPosition;
      return { ...standing, positionChange };
    });
    return [classId, augmented];
  });
};
