import type {
  SessionInfo,
  SessionResults,
  Driver,
  Session,
  Telemetry,
} from '@irdashies/types';
import {
  calculateIRatingGain,
  RaceResult,
  CalculationResult,
} from '@irdashies/utils/iratingGain';

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
  };
  fastestTime: number;
  hasFastestTime: boolean;
  lastTime: number;
  onPitRoad: boolean;
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
        },
        fastestTime: result.FastestTime,
        hasFastestTime: result.CarIdx === fastestDriverIdx,
        lastTime: result.LastTime,
        onPitRoad: telemetry?.carIdxOnPitRoadValue?.[result.CarIdx] ?? false,
        onTrack:
          (telemetry?.carIdxTrackSurfaceValue?.[result.CarIdx] ?? -1) > -1,
        carClass: {
          id: driver.CarClassID,
          color: driver.CarClassColor,
          name: driver.CarClassShortName,
          relativeSpeed: driver.CarClassRelSpeed,
          estLapTime: driver.CarClassEstLapTime,
        },
        radioActive: telemetry.radioTransmitCarIdx?.includes(result.CarIdx),
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
 */
export const sliceRelevantDrivers = <T extends { isPlayer?: boolean }>(
  groupedStandings: [string, T[]][],
  { buffer = 3 } = {}
): [string, T[]][] => {
  // this is honestly a bit too complicated to maintain so after some testing will
  // probably simplify it so its a bit more readable
  return groupedStandings.map(([classIdx, standings]) => {
    const playerIndex = standings.findIndex((driver) => driver.isPlayer);
    if (playerIndex < 0) {
      // if player is not in this class, return only top 3 drivers in that class
      return [classIdx, standings.slice(0, 3)];
    }

    // if there are less than 10 drivers, return all
    if (standings.length <= 10) return [classIdx, standings];

    // take the player and a buffer of drivers before and after the player
    const start = Math.max(playerIndex - buffer, 0);
    let end = Math.min(playerIndex + buffer + 1, standings.length);

    if (playerIndex <= 3) {
      // if player is in top 3, include more drivers at the end
      end = Math.min(
        playerIndex + buffer + 3 - playerIndex + 1,
        standings.length
      );
    }

    const sliced = standings.slice(start, end);

    if (playerIndex > 3) {
      // add back top 3 but don't include overlapping indexes
      // reverse to add in correct order when doing array unshift
      standings
        .slice(0, 3)
        .reverse()
        .forEach((driver) => {
          if (!sliced.includes(driver)) sliced.unshift(driver);
        });
    }

    return [classIdx, sliced];
  });
};

/**
 * This method will create the standings for the current session
 * It will group the standings by class and slice the relevant drivers
 */
export const createStandings = (
  session?: Session,
  telemetry?: Telemetry,
  currentSession?: SessionInfo,
  options?: {
    sliceRelevantDrivers?: {
      buffer?: number;
    };
  }
) => {
  const standings = createDriverStandings(
    {
      playerIdx: session?.DriverInfo?.DriverCarIdx,
      drivers: session?.DriverInfo?.Drivers,
      qualifyingResults: session?.QualifyResultsInfo?.Results,
    },
    {
      carIdxF2TimeValue: telemetry?.CarIdxF2Time?.value,
      carIdxOnPitRoadValue: telemetry?.CarIdxOnPitRoad?.value,
      carIdxTrackSurfaceValue: telemetry?.CarIdxTrackSurface?.value,
      radioTransmitCarIdx: telemetry?.RadioTransmitCarIdx?.value,
    },
    {
      resultsPositions: currentSession?.ResultsPositions,
      resultsFastestLap: currentSession?.ResultsFastestLap,
      sessionType: currentSession?.SessionType,
    }
  );

  const grouped = groupStandingsByClass(standings);
  return sliceRelevantDrivers(grouped, options?.sliceRelevantDrivers);
};
