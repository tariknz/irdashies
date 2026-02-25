import type { SessionResults, Driver } from '@irdashies/types';
import {
  calculateIRatingGain,
  RaceResult,
  CalculationResult,
} from '@irdashies/utils/iratingGain';
import { GlobalFlags } from '@irdashies/types';
import { useReferenceLapStore } from '../../context/ReferenceLapStore/ReferenceLapStore';
import {
  calculateClassEstimatedDelta,
  calculateClassEstimatedGap,
  calculateReferenceDelta,
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
    carIdxTrackSurfaceValue?: number[];
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
  prevCarTrackSurface: number[],
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

  const fastestDriverIdx = currentSession.resultsFastestLap?.[0]?.CarIdx;
  const fastestDriver = results?.find((r) => r.CarIdx === fastestDriverIdx);

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
      return {
        carIdx: result.CarIdx,
        position: result.Position,
        classPosition: result.ClassPosition + 1,
        delta: calculateDelta(
          result.CarIdx,
          result.FastestTime,
          telemetry.carIdxF2TimeValue ?? [],
          currentSession?.sessionType,
          fastestDriver?.FastestTime
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
        hasFastestTime: result.CarIdx === fastestDriverIdx,
        lastTime: result.LastTime,
        lastTimeState: getLastTimeState(
          result.LastTime,
          result.FastestTime,
          result.CarIdx === fastestDriverIdx
        ),
        onPitRoad: telemetry?.carIdxOnPitRoadValue?.[result.CarIdx] ?? false,
        onTrack:
          (telemetry?.carIdxTrackSurfaceValue?.[result.CarIdx] ?? -1) > -1,
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
  const notYetInResults = (session.drivers ?? [])
    .filter(
      (driver) =>
        !driver.CarIsPaceCar &&
        !driver.IsSpectator &&
        !mappedCarIdxs.has(driver.CarIdx)
    )
    .sort(sortByCarNumber)
    .map((driver, index) => ({
      carIdx: driver.CarIdx,
      position: mapped.length + index + 1,
      classPosition: mapped.length + index + 1,
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
      onTrack: (telemetry?.carIdxTrackSurfaceValue?.[driver.CarIdx] ?? -1) > -1,
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
  carIdxEstTime: number[],
  carIdxLapDistPct: number[],
  carIdxIsOnPitRoad: boolean[]
): [string, Standings[]][] => {
  return groupedStandings.map(([classId, classStandings]) => {
    // Find class leader (lowest class position)
    const sortedByClassPosition = classStandings
      .filter((s) => s.classPosition && s.classPosition > 0)
      .sort((a, b) => (a.classPosition ?? 999) - (b.classPosition ?? 999));

    const classLeader = sortedByClassPosition[0];
    if (!classLeader || classLeader.delta === undefined) {
      return [classId, classStandings];
    }

    // Calculate gap for each driver
    const augmentedClassStandings = classStandings.map(
      (driverStanding, index) => {
        if (driverStanding.carIdx === classLeader.carIdx) {
          // Class leader shows as dash (undefined gap)
          return { ...driverStanding, gap: { value: undefined, laps: 0 } };
        }

        const driverIdx = driverStanding.carIdx;
        const classId = driverStanding.carClass.id;
        const isStartingLap = (driverStanding?.lap ?? -1) <= 1;

        const refLap = useReferenceLapStore
          .getState()
          .getReferenceLap(driverIdx, classId, isStartingLap);

        const isOnPitRoadAhead = carIdxIsOnPitRoad[classLeader.carIdx];
        const isOnPitRoadBehind = carIdxIsOnPitRoad[driverIdx];
        const isAnyoneOnPitRoad = isOnPitRoadAhead || isOnPitRoadBehind;

        const isOnPitOrHasNoData = isAnyoneOnPitRoad || refLap.finishTime < 0;

        let calculatedGap = 0;
        let calculatedInterval = 0;

        const driverAhead = classStandings[index - 1];

        if (isOnPitOrHasNoData) {
          const aheadEstTime = carIdxEstTime[classLeader.carIdx];
          const behindEstTime = carIdxEstTime[driverIdx];

          const driverStats = getStats(behindEstTime, driverStanding);

          calculatedGap = calculateClassEstimatedDelta(
            getStats(aheadEstTime, classLeader),
            driverStats,
            false //isTargetAhead
          );
          calculatedInterval = calculateClassEstimatedDelta(
            getStats(aheadEstTime, driverAhead),
            driverStats,
            false //isTargetAhead
          );
        } else {
          const classLeaderTrckPct = carIdxLapDistPct[classLeader.carIdx];
          const driverTrckPct = carIdxLapDistPct[driverIdx];
          const driverAheadTrckPct = carIdxLapDistPct[driverAhead.carIdx];

          calculatedGap = calculateReferenceDelta(
            refLap,
            driverTrckPct,
            classLeaderTrckPct
          );
          calculatedInterval = calculateReferenceDelta(
            refLap,
            driverTrckPct,
            driverAheadTrckPct
          );
        }

        // Gap is simply the difference between this driver's delta and the class leader's delta
        const gapValue =
          driverStanding.delta !== undefined && classLeader.delta !== undefined
            ? driverStanding.delta - classLeader.delta
            : undefined;

        const gap = {
          value: calculatedGap,
          laps: 0,
        };

        if (gapValue && classLeader.fastestTime > 0) {
          const lapsOfGap = -Math.floor(gapValue / classLeader.fastestTime);
          gap.laps = lapsOfGap;
        }

        // Only show positive gaps (drivers behind class leader)
        return {
          ...driverStanding,
          gap: gapValue && gapValue > 0 ? gap : undefined,
          interval: Math.abs(calculatedInterval),
        };
      }
    );

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
    const sortedByGap = classStandings
      .filter((s) => s.gap !== undefined && !s.isPlayer) // Only drivers with gap data
      .sort((a, b) => (a.gap?.value ?? 999) - (b.gap?.value ?? 999));

    // Create a map of gap differences
    const intervalMap = new Map<number, number | undefined>();

    // Calculate intervals: for each driver, subtract their gap from the gap of the driver immediately behind them
    for (let i = 0; i < sortedByGap.length - 1; i++) {
      const currentDriver = sortedByGap[i];
      const driverBehind = sortedByGap[i + 1];

      if (
        currentDriver.gap?.value !== undefined &&
        driverBehind.gap?.value !== undefined &&
        driverBehind.carIdx
      ) {
        // interval = gap_behind - gap_current (positive means behind is farther from leader)
        intervalMap.set(
          driverBehind.carIdx,
          driverBehind.gap.value - currentDriver.gap.value
        );
      }
    }

    // Set interval for the driver with the smallest gap (2nd place) to show how far behind P1 they are
    if (
      sortedByGap.length > 0 &&
      sortedByGap[0].gap?.value !== undefined &&
      sortedByGap[0].carIdx !== undefined
    ) {
      intervalMap.set(sortedByGap[0].carIdx, sortedByGap[0].gap.value);
    }

    // Apply intervals to all drivers in this class
    const augmentedClassStandings = classStandings.map((driverStanding) => {
      // Player shows as undefined (no interval)
      const interval = driverStanding.isPlayer
        ? undefined
        : intervalMap.get(driverStanding.carIdx);

      return { ...driverStanding, interval };
    });

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

export interface AugmentOptions {
  sessionType: 'Race' | 'Practice' | 'Qualify';
  isOfficial: boolean;
  gapEnabled: boolean;
  intervalEnabled: boolean;
  qualifyingResults?: SessionResults[];
  carIdxEstTime: number[];
  carIdxLap: number[];
  carIdxLapDistPct: number[];
  carIdxOnPitRoad: boolean[];
}

/**
 * Single-pass augmentation of standings with position change, iRating, gap and interval data.
 * Replaces augmentStandingsWithPositionChange + augmentStandingsWithIRating + augmentStandingsWithGap.
 */
export const augmentStandings = (
  groupedStandings: [string, Standings[]][],
  options: AugmentOptions
): [string, Standings[]][] => {
  const {
    sessionType,
    isOfficial,
    gapEnabled,
    intervalEnabled,
    qualifyingResults,
    carIdxEstTime,
    carIdxLap,
    carIdxLapDistPct,
    carIdxOnPitRoad,
  } = options;

  const isRace = sessionType === 'Race';
  const needsGap = gapEnabled || intervalEnabled;

  // --- Pre-compute qualifying position map (used per-driver below) ---
  const qualifyingClassPositionByCarIdx = new Map<number, number>();
  if (isRace && qualifyingResults && qualifyingResults.length > 0) {
    qualifyingResults.forEach((result) => {
      qualifyingClassPositionByCarIdx.set(
        result.CarIdx,
        result.ClassPosition + 1
      );
    });
  }

  return groupedStandings.map(([classId, classStandings]) => {
    // --- Pre-compute iRating change map for this class (requires all drivers) ---
    const iratingChangeMap = new Map<number, number>();
    if (isRace && isOfficial) {
      const raceResultsInput: RaceResult<number>[] = classStandings
        .filter((s) => !!s.classPosition)
        .map((s) => ({
          driver: s.carIdx,
          finishRank: s.classPosition ?? 0,
          startIRating: s.driver.rating,
          started: true,
        }));

      if (raceResultsInput.length > 0) {
        calculateIRatingGain(raceResultsInput).forEach(
          (calcResult: CalculationResult<number>) => {
            iratingChangeMap.set(
              calcResult.raceResult.driver,
              calcResult.iratingChange
            );
          }
        );
      }
    }

    // --- Pre-compute class leader for gap calculations ---
    const classLeader = needsGap
      ? classStandings
          .filter((s) => s.classPosition && s.classPosition > 0)
          .sort(
            (a, b) => (a.classPosition ?? 999) - (b.classPosition ?? 999)
          )[0]
      : undefined;

    const leaderHasData = classLeader && classLeader.delta !== undefined;

    // --- Single pass over drivers ---
    return [
      classId,
      classStandings.map((standing, index) => {
        const augmented = { ...standing };

        // Position change
        if (isRace && qualifyingClassPositionByCarIdx.size > 0) {
          const qualifyingClassPos = qualifyingClassPositionByCarIdx.get(
            standing.carIdx
          );
          if (
            qualifyingClassPos !== undefined &&
            standing.classPosition !== undefined
          ) {
            augmented.positionChange =
              qualifyingClassPos - standing.classPosition;
          }
        }

        // iRating change
        if (isRace && isOfficial) {
          augmented.iratingChange = iratingChangeMap.get(standing.carIdx);
        }

        // Gap + interval
        if (needsGap && classLeader) {
          if (!leaderHasData) {
            // No-op: leave gap/interval undefined
          } else if (standing.carIdx === classLeader.carIdx) {
            augmented.gap = { value: undefined, laps: 0 };
          } else {
            const driverIdx = standing.carIdx;
            const driverClassId = standing.carClass.id;
            const isStartingLap = (standing?.lap ?? -1) <= 1;

            const refLap = useReferenceLapStore
              .getState()
              .getReferenceLap(driverIdx, driverClassId, isStartingLap);

            const isOnPitRoadAhead = carIdxOnPitRoad[classLeader.carIdx];
            const isOnPitRoadBehind = carIdxOnPitRoad[driverIdx];
            const isOnPitOrHasNoData =
              isOnPitRoadAhead || isOnPitRoadBehind || refLap.finishTime < 0;

            const driverAhead = classStandings[index - 1];

            let calculatedGap = 0;
            let calculatedInterval = 0;

            if (isOnPitOrHasNoData) {
              const classLeaderEstTime = carIdxEstTime[classLeader.carIdx];
              const aheadEstTime = carIdxEstTime[driverAhead.carIdx];
              const behindEstTime = carIdxEstTime[driverIdx];
              const driverStats = getStats(behindEstTime, standing);

              calculatedGap = calculateClassEstimatedGap(
                getStats(classLeaderEstTime, classLeader),
                driverStats
              );
              calculatedInterval = calculateClassEstimatedDelta(
                getStats(aheadEstTime, driverAhead),
                driverStats,
                false
              );
            } else {
              const classLeaderTrckPct = carIdxLapDistPct[classLeader.carIdx];
              const driverTrckPct = carIdxLapDistPct[driverIdx];
              const driverAheadTrckPct = carIdxLapDistPct[driverAhead.carIdx];

              calculatedGap = calculateReferenceGap(
                refLap,
                classLeaderTrckPct,
                driverTrckPct
              );
              calculatedInterval = calculateReferenceDelta(
                refLap,
                driverAheadTrckPct,
                driverTrckPct
              );
            }

            const gap = { value: Math.abs(calculatedGap), laps: 0 };

            if (classLeader.fastestTime > 0) {
              const driverLapNumber = carIdxLap[driverIdx];
              const classLeaderLapNumber = carIdxLap[classLeader.carIdx];
              gap.laps = Math.floor(
                classLeaderLapNumber +
                  carIdxLapDistPct[classLeader.carIdx] -
                  (driverLapNumber + carIdxLapDistPct[driverIdx])
              );
            }

            augmented.gap = gap;
            augmented.interval = Math.abs(calculatedInterval);
          }
        }

        return augmented;
      }),
    ];
  });
};
