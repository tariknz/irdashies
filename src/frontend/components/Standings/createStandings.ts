import type { SessionResults, Driver } from '@irdashies/types';
import { calculateIRatingGain, RaceResult, CalculationResult } from '@irdashies/utils/iratingGain';

export interface Standings {
  carIdx: number;
  position?: number;
  classPosition?: number;
  lap?: number;
  lappedState?: 'ahead' | 'behind' | 'same';
  delta?: number;
  isPlayer: boolean;
  driver: {
    name: string;
    carNum: string;
    license: string;
    rating: number;
    flairId?: number;
  };
  fastestTime: number;
  hasFastestTime: boolean;
  lastTime: number;
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
  },
  currentSession: {
    resultsPositions?: SessionResults[];
    resultsFastestLap?: {
      CarIdx: number;
      FastestLap: number;
      FastestTime: number;
    }[];
    sessionType?: string;
  }
): Standings[] => {
  const results =
    currentSession.resultsPositions ?? session.qualifyingResults ?? [];
  const fastestDriverIdx = currentSession.resultsFastestLap?.[0]?.CarIdx;
  const fastestDriver = results?.find((r) => r.CarIdx === fastestDriverIdx);

  return results
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
        },
        fastestTime: result.FastestTime,
        hasFastestTime: result.CarIdx === fastestDriverIdx,
        lastTime: result.LastTime,
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
        carId: driver.CarID
      };
    })
    .filter((s) => !!s);
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
      .filter(s => !!s.classPosition)  // Only include drivers with a class position, should not happen in races
      .map(
        (driverStanding) => ({
          driver: driverStanding.carIdx,
          finishRank: driverStanding.classPosition ?? 0,
          startIRating: driverStanding.driver.rating,
          started: true, // This is a critical assumption.
        })
      );

    if (raceResultsInput.length === 0) {
      return [classId, classStandings];
    }

    const iratingCalculationResults = calculateIRatingGain(raceResultsInput);

    const iratingChangeMap = new Map<number, number>();
    iratingCalculationResults.forEach((calcResult: CalculationResult<number>) => {
      iratingChangeMap.set(calcResult.raceResult.driver, calcResult.iratingChange);
    });

    const augmentedClassStandings = classStandings.map(
      (driverStanding) => ({
        ...driverStanding,
        iratingChange: iratingChangeMap.get(driverStanding.carIdx),
      })
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

    // Ensure we have at least `minPlayerClassDrivers`
    let lastIndex = end;
    while (
      relevantDrivers.size < minPlayerClassDrivers &&
      lastIndex < standings.length
    ) {
      relevantDrivers.add(standings[lastIndex]);
      lastIndex++;
    }

    const sortedDrivers = standings.filter((driver) =>
      relevantDrivers.has(driver),
    );

    return [classIdx, sortedDrivers];
  });
};
