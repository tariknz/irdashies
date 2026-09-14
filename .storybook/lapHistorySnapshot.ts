import {
  LAP_CROSSING_IN_PIT,
  LAP_HISTORY_CAPACITY,
  type Driver,
  type LapHistorySnapshot,
  type Session,
} from '@irdashies/types';
import sessionFixture from '../src/app/irsdk/node/utils/mock-data/session.json';

/** The mock session's Race entry. Anything else hides the lap graph by design. */
export const RACE_SESSION_NUM = 2;

/** Where the race starts on the session clock, in seconds. */
const RACE_START_SECONDS = 600;

const CAR_SLOTS = 64;

/** Deterministic noise, so a story looks the same on every reload. */
const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

export interface CarPlan {
  carIdx: number;
  classId: number;
  /** Green lap time in seconds. */
  lapSeconds: number;
  laps: number;
  /** Delay off the line, in seconds. */
  gridOffset: number;
  /** Laps the car pits on. */
  pitLaps?: readonly number[];
  pitLossSeconds?: number;
  /** A long unscheduled repair, on top of the normal stops. */
  repair?: { lap: number; seconds: number };
}

interface CarRun {
  plan: CarPlan;
  times: number[];
  positions: number[];
}

const crossingTimes = (plan: CarPlan): number[] => {
  const random = seededRandom(plan.carIdx * 7919 + 13);
  const times: number[] = [];
  let elapsed = RACE_START_SECONDS + plan.gridOffset;

  for (let lap = 1; lap <= plan.laps; lap += 1) {
    const jitter = (random() - 0.5) * 0.8;
    const pitLoss = plan.pitLaps?.includes(lap)
      ? (plan.pitLossSeconds ?? 34)
      : 0;
    const repair = plan.repair?.lap === lap ? plan.repair.seconds : 0;
    elapsed += plan.lapSeconds + jitter + pitLoss + repair;
    times.push(elapsed);
  }

  return times;
};

/**
 * Builds a snapshot in the real ring layout: crossing `i` of car `c` lives at
 * `c * capacity + (start[c] + i) % capacity`. Anything past the capacity wraps,
 * exactly as the processor's buffer does over a long race.
 */
export const buildLapHistory = (
  plans: readonly CarPlan[]
): LapHistorySnapshot => {
  const capacity = LAP_HISTORY_CAPACITY;
  const size = CAR_SLOTS * capacity;
  const count = new Array<number>(CAR_SLOTS).fill(0);
  const start = new Array<number>(CAR_SLOTS).fill(0);
  const lap = new Array<number>(size).fill(0);
  const sessionTime = new Array<number>(size).fill(0);
  const classPosition = new Array<number>(size).fill(0);
  const flags = new Array<number>(size).fill(0);

  const runs: CarRun[] = plans.map((plan) => ({
    plan,
    times: crossingTimes(plan),
    positions: [],
  }));

  // Class position is ranked within the class at each lap, the way the
  // processor reads it from telemetry.
  const maxLaps = runs.reduce(
    (most, run) => Math.max(most, run.times.length),
    0
  );
  const classIds = [...new Set(plans.map((plan) => plan.classId))];
  for (const classId of classIds) {
    const inClass = runs.filter((run) => run.plan.classId === classId);
    for (let lapNum = 1; lapNum <= maxLaps; lapNum += 1) {
      const runners = inClass
        .filter((run) => run.times.length >= lapNum)
        .sort((a, b) => a.times[lapNum - 1] - b.times[lapNum - 1]);
      runners.forEach((run, index) => {
        run.positions[lapNum - 1] = index + 1;
      });
    }
  }

  for (const run of runs) {
    const carIdx = run.plan.carIdx;
    if (carIdx < 0 || carIdx >= CAR_SLOTS) continue;
    const total = run.times.length;
    const base = carIdx * capacity;
    for (let i = 0; i < total; i += 1) {
      const slot = base + (i % capacity);
      lap[slot] = i + 1;
      sessionTime[slot] = run.times[i];
      classPosition[slot] = run.positions[i] ?? 0;
      const inPit =
        run.plan.pitLaps?.includes(i + 1) || run.plan.repair?.lap === i + 1;
      flags[slot] = inPit ? LAP_CROSSING_IN_PIT : 0;
    }
    count[carIdx] = Math.min(total, capacity);
    start[carIdx] = total > capacity ? total % capacity : 0;
  }

  return {
    carCount: CAR_SLOTS,
    capacity,
    count,
    start,
    lap,
    sessionTime,
    classPosition,
    flags,
    sessionNum: RACE_SESSION_NUM,
    version: 1,
  };
};

const fixtureSession = sessionFixture as unknown as Session;

export const fixtureDrivers = fixtureSession.DriverInfo.Drivers.filter(
  (driver) => !driver.CarIsPaceCar
);

interface FieldOptions {
  laps: number;
  pitCarIdx?: number;
  pitLap?: number;
}

/** The mock session: 41 cars over 4 classes. */
export const fixturePlans = ({
  laps,
  pitCarIdx,
  pitLap,
}: FieldOptions): CarPlan[] =>
  fixtureDrivers.map((driver, index) => ({
    carIdx: driver.CarIdx,
    classId: driver.CarClassID,
    lapSeconds: driver.CarClassEstLapTime + ((index * 7) % 9) * 0.4,
    laps,
    gridOffset: index * 0.9,
    pitLaps:
      pitCarIdx === driver.CarIdx && pitLap !== undefined
        ? [pitLap]
        : undefined,
    pitLossSeconds: 34,
  }));

/** A 28-lap sprint over the fixture grid. The default for Gantry stories. */
export const sprintLapHistory = buildLapHistory(fixturePlans({ laps: 28 }));

/** Race session, no crossings recorded yet. */
export const emptyLapHistory = buildLapHistory([]);

// --- Endurance fixture: 60 cars over 2 classes, 500 laps ---------------------

const CLASS_TEMPLATES = [
  ...new Map(
    fixtureDrivers.map((driver) => [driver.CarClassID, driver])
  ).values(),
];

/** Two classes, so the plotted class is a realistic 30-car endurance grid. */
const ENDURANCE_CLASS_TEMPLATES = CLASS_TEMPLATES.slice(0, 2);

const ENDURANCE_CARS = 60;
const ENDURANCE_LAPS = 500;

export const ENDURANCE_PLAYER_IDX = 7;

const enduranceDrivers: Driver[] = Array.from(
  { length: ENDURANCE_CARS },
  (_, index) => {
    const template =
      ENDURANCE_CLASS_TEMPLATES[index % ENDURANCE_CLASS_TEMPLATES.length];
    return {
      ...template,
      CarIdx: index,
      CarNumber: String(index + 1),
      CarNumberRaw: index + 1,
      UserName: `Driver ${String(index + 1).padStart(2, '0')}`,
      TeamName: `Team ${String(index + 1).padStart(2, '0')}`,
    };
  }
);

export const enduranceSession: Session = {
  ...fixtureSession,
  DriverInfo: {
    ...fixtureSession.DriverInfo,
    DriverCarIdx: ENDURANCE_PLAYER_IDX,
    Drivers: enduranceDrivers,
  },
  SessionInfo: {
    ...fixtureSession.SessionInfo,
    Sessions: [
      {
        ...fixtureSession.SessionInfo.Sessions[RACE_SESSION_NUM],
        ResultsPositions: [],
        QualifyPositions: [],
      },
    ],
  },
  QualifyResultsInfo: { Results: [] },
};

/** Pit laps for one car: every 40 laps, offset so the field does not stack. */
const stintStops = (index: number): number[] => {
  const stops: number[] = [];
  for (let lap = 40 + (index % 8) * 3; lap < ENDURANCE_LAPS; lap += 40) {
    stops.push(lap);
  }
  return stops;
};

const endurancePlans: CarPlan[] = enduranceDrivers.map((driver, index) => ({
  carIdx: driver.CarIdx,
  classId: driver.CarClassID,
  lapSeconds: driver.CarClassEstLapTime + ((index * 5) % 11) * 0.35,
  laps: ENDURANCE_LAPS,
  gridOffset: index * 1.1,
  // A stop every 40 laps or so, staggered across the field. One car loses ten
  // minutes to a repair at half distance - the case that used to flatten the
  // whole plot.
  pitLaps: stintStops(index),
  pitLossSeconds: 34,
  repair:
    index === 17
      ? { lap: Math.floor(ENDURANCE_LAPS / 2), seconds: 600 }
      : undefined,
}));

export const enduranceLapHistory = buildLapHistory(endurancePlans);
