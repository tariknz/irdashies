import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GlobalFlags,
  SessionState,
  TrackLocation,
  type RacePlanProjectedStint,
  type Session,
  type Telemetry,
} from '@irdashies/types';
import { normalizeRacePlanning } from '../services/racePlanNormalize';
import {
  FIXTURE_DRIVER_IDS,
  rawPlanningFixture,
} from '../services/racePlanFixture';
import type { RacePlanHistoryRecord } from '../storage/racePlanHistory';
import {
  MAX_RACE_PLAN_STOPS,
  RacePlanProgressProcessor,
  type RacePlanHistoryPersistence,
  type RacePlanSelection,
} from './RacePlanProgressProcessor';
import {
  rebaselinePlan,
  type RebaselineInput,
  type RebaselineResult,
} from './racePlanRebaseline';

vi.mock('./racePlanRebaseline', () => ({ rebaselinePlan: vi.fn() }));

const [DRIVER_A, DRIVER_B] = FIXTURE_DRIVER_IDS;
const TEAM_ID = 5001;
const TRACK_ID = 166;
const SUB_SESSION_ID = 880001;
const RACE_SESSION = 1;
const BOX_AFTER_LAPS = 33;
const PLAN_LAP_SEC = 60;
const CLOCK_BASE_MS = Date.parse('2030-06-01T11:58:00Z');

/**
 * A stand-in for the engine, which is tested on its own: the actual stints as
 * done/current, a box lap a fixed number of laps into the current stint, and
 * drift against a flat plan pace.
 */
const fakeEngine = (input: RebaselineInput): RebaselineResult => {
  const stints: RacePlanProjectedStint[] = input.actual.map((stint, i) => ({
    number: i + 1,
    planNumber: stint.planIndex + 1,
    driverId: stint.driverId,
    plannedStartSec: null,
    plannedEndSec: null,
    startSec: stint.startSec,
    endSec: stint.endSec ?? input.elapsedSec,
    startLap: stint.startLap,
    laps: (stint.endLap ?? input.teamLaps) - stint.startLap,
    status: stint.endLap === null ? 'current' : 'done',
    setup: input.conditions,
    rebuilt: false,
  }));
  const current = input.actual.at(-1);
  return {
    stints,
    boxLap:
      current && current.endLap === null
        ? current.startLap + BOX_AFTER_LAPS
        : null,
    driftSec: current ? input.elapsedSec - input.teamLaps * PLAN_LAP_SEC : null,
  };
};

const engine = vi.mocked(rebaselinePlan);
const lastInput = (): RebaselineInput => {
  const input = engine.mock.calls.at(-1)?.[0];
  if (!input) throw new Error('rebaselinePlan was not called');
  return input;
};

const fixturePlan = (): RacePlanSelection => {
  const planning = normalizeRacePlanning(rawPlanningFixture());
  if (!planning) throw new Error('fixture failed to normalize');
  return { planning, strategy: planning.strategies[0] };
};

interface SessionOptions {
  driverId?: number;
  teamId?: number;
  trackId?: number;
  subSessionId?: number;
  simMode?: string;
}

const makeSession = (options: SessionOptions = {}): Session =>
  ({
    WeekendInfo: {
      TrackID: options.trackId ?? TRACK_ID,
      SubSessionID: options.subSessionId ?? SUB_SESSION_ID,
      SimMode: options.simMode ?? 'full',
    },
    DriverInfo: {
      DriverCarIdx: 0,
      DriverCarFuelMaxLtr: 40,
      DriverCarMaxFuelPct: 0.9,
      DriverTires: [
        { TireIndex: 0, TireCompoundType: 'Hard' },
        { TireIndex: 1, TireCompoundType: 'Wet' },
      ],
      Drivers: [
        {
          CarIdx: 0,
          UserID: options.driverId ?? DRIVER_A,
          TeamID: options.teamId ?? TEAM_ID,
        },
        { CarIdx: 1, UserID: 9999, TeamID: 4 },
      ],
    },
    SessionInfo: {
      Sessions: [
        { SessionNum: 0, SessionType: 'Practice' },
        { SessionNum: RACE_SESSION, SessionType: 'Race' },
      ],
    },
  }) as unknown as Session;

interface LapOptions {
  lapSec?: number;
  fuelPerLap?: number;
  flags?: number;
}

interface PitOptions {
  stallSec?: number;
  pitRoadSec?: number;
  fuelAdd?: number;
  compoundTo?: number;
  driverTo?: number;
  /** Seconds after the stall exit that the session info shows the swap. */
  sessionDelaySec?: number;
  /** The session info shows the swap while the car is still in the stall. */
  swapInStall?: boolean;
}

/** A team car driven second by second; each tick is one processor frame. */
class Sim {
  time = 500;
  laps = 0;
  fuel = 30;
  compound = 0;
  surface: number = TrackLocation.OnTrack;
  pitRoad = false;
  state: number = SessionState.ParadeLaps;
  flags = 0;
  lastLap = -1;
  replay = false;
  fuelVisible = true;
  /** What CarIdxLapCompleted reads instead of `laps`, e.g. -1. */
  lapCountOverride: number | null = null;
  sessionOptions: SessionOptions = {};

  constructor(public processor: RacePlanProgressProcessor) {
    processor.init(makeSession());
  }

  get snapshot() {
    return this.processor.snapshot();
  }

  frame(): Telemetry {
    const values: Record<string, unknown> = {
      SessionTime: this.time,
      SessionNum: RACE_SESSION,
      SessionState: this.state,
      SessionFlags: this.flags,
      SessionTimeTotal: 86_400,
      SessionTimeRemain: 86_400 - this.time,
      IsReplayPlaying: this.replay,
      FuelLevel: this.fuelVisible ? this.fuel : 0,
      WeatherDeclaredWet: false,
      CarIdxLapCompleted: [this.lapCountOverride ?? this.laps, 0],
      CarIdxTrackSurface: [this.surface, TrackLocation.OnTrack],
      CarIdxOnPitRoad: [this.pitRoad, false],
      CarIdxTireCompound: [this.compound, 0],
      CarIdxLastLapTime: [this.lastLap, 0],
    };
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        { value: Array.isArray(value) ? value : [value] },
      ])
    ) as unknown as Telemetry;
  }

  tick(count = 1): void {
    for (let i = 0; i < count; i += 1) {
      this.time += 1;
      this.processor.onFrame(this.frame());
    }
  }

  green(): void {
    this.tick();
    this.state = SessionState.Racing;
    this.tick();
  }

  lap({ lapSec = PLAN_LAP_SEC, fuelPerLap = 1, flags = 0 }: LapOptions = {}) {
    this.flags = flags;
    for (let second = 1; second <= lapSec; second += 1) {
      this.fuel -= fuelPerLap / lapSec;
      if (second === lapSec) {
        this.laps += 1;
        this.lastLap = lapSec;
      }
      this.tick();
    }
    this.flags = 0;
  }

  driveLaps(count: number, options?: LapOptions): void {
    for (let i = 0; i < count; i += 1) this.lap(options);
  }

  setDriver(driverId: number): void {
    this.setSession({ driverId });
  }

  setSession(options: SessionOptions): void {
    this.sessionOptions = { ...this.sessionOptions, ...options };
    this.processor.init(makeSession(this.sessionOptions));
  }

  pit({
    stallSec = 30,
    pitRoadSec = 10,
    fuelAdd = 0,
    compoundTo,
    driverTo,
    sessionDelaySec = 0,
    swapInStall = false,
  }: PitOptions = {}): void {
    this.pitRoad = true;
    this.surface = TrackLocation.ApproachingPits;
    this.tick(pitRoadSec);
    this.surface = TrackLocation.InPitStall;
    for (let second = 1; second <= stallSec; second += 1) {
      this.fuel += fuelAdd / stallSec;
      if (second === stallSec && compoundTo !== undefined) {
        this.compound = compoundTo;
      }
      if (second === 2 && swapInStall && driverTo !== undefined) {
        this.setDriver(driverTo);
      }
      this.tick();
    }
    this.surface = TrackLocation.ApproachingPits;
    let remaining = pitRoadSec;
    if (driverTo !== undefined && !swapInStall) {
      this.tick(sessionDelaySec);
      remaining -= sessionDelaySec;
      this.setDriver(driverTo);
    }
    this.tick(Math.max(0, remaining));
    this.pitRoad = false;
    this.surface = TrackLocation.OnTrack;
  }
}

const memoryPersistence = () => {
  const records = new Map<number, RacePlanHistoryRecord>();
  return {
    records,
    load: vi.fn((id: number) => {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    }),
    save: vi.fn((record: RacePlanHistoryRecord) => {
      records.set(record.subSessionId, structuredClone(record));
    }),
  } satisfies RacePlanHistoryPersistence & { records: unknown };
};

interface StartOptions {
  plan?: () => RacePlanSelection | null;
  persistence?: RacePlanHistoryPersistence;
  sourceReplay?: boolean;
  green?: boolean;
}

const start = ({
  plan,
  persistence,
  sourceReplay,
  green = true,
}: StartOptions = {}) => {
  const selection = fixturePlan();
  const clock = { sim: undefined as Sim | undefined };
  const processor = new RacePlanProgressProcessor({
    getPlan: plan ?? (() => selection),
    persistence,
    now: () => CLOCK_BASE_MS + (clock.sim?.time ?? 0) * 1000,
    sourceReplay,
  });
  const sim = new Sim(processor);
  clock.sim = sim;
  if (green) sim.green();
  return { sim, processor, selection };
};

beforeEach(() => {
  engine.mockReset();
  engine.mockImplementation(fakeEngine);
});

describe('RacePlanProgressProcessor', () => {
  it('publishes on race-plan.progress once a second', () => {
    const processor = new RacePlanProgressProcessor({ getPlan: () => null });
    expect(processor.channel).toBe('race-plan.progress');
    expect(processor.tickRateHz).toBe(1);
    expect(processor.snapshot().status).toBe('no-plan');
  });

  it('reports no-plan and never rebuilds without a plan', () => {
    const { sim } = start({ plan: () => null });
    sim.driveLaps(2);
    expect(sim.snapshot).toMatchObject({
      status: 'no-plan',
      planningId: null,
      raceStartMs: null,
      stints: [],
    });
    expect(engine).not.toHaveBeenCalled();
  });

  it('waits before the green flag, timed from the plan start', async () => {
    const actual = await vi.importActual<typeof import('./racePlanRebaseline')>(
      './racePlanRebaseline'
    );
    engine.mockImplementation(actual.rebaselinePlan);
    const { sim, selection } = start({ green: false });
    sim.tick(5);
    const snapshot = sim.snapshot;
    expect(snapshot.status).toBe('waiting');
    expect(snapshot.raceStartMs).toBe(selection.strategy.raceStartMs);
    expect(snapshot.elapsedSec).toBe(
      (CLOCK_BASE_MS + sim.time * 1000 - selection.strategy.raceStartMs) / 1000
    );
    expect(snapshot.currentStintIndex).toBeNull();
    expect(snapshot.lapsUntilBox).toBeNull();
    expect(snapshot.stints.length).toBeGreaterThan(0);
    expect(snapshot.stints[0].plannedStartSec).toBe(0);
    expect(lastInput()).toMatchObject({ actual: [], teamLaps: 0 });
    // Only the first frame rebuilds; the clock ticking is not an event.
    expect(engine).toHaveBeenCalledTimes(1);
  });

  it('tracks a race on plan, rebuilding once per lap', () => {
    const { sim } = start();
    const greenTime = sim.time;
    sim.driveLaps(5);
    expect(sim.snapshot).toMatchObject({
      status: 'racing',
      planningId: 9001,
      strategyId: 7001,
      mismatches: [],
      raceStartMs: CLOCK_BASE_MS + greenTime * 1000,
      elapsedSec: 5 * PLAN_LAP_SEC,
      teamLaps: 5,
      driverId: DRIVER_A,
      currentStintIndex: 0,
      lapsInStint: 5,
      boxLap: BOX_AFTER_LAPS,
      lapsUntilBox: BOX_AFTER_LAPS - 6,
      fuelVisible: true,
      fuelLevel: 25,
      fuelPerLap: 1,
      lapTimeSec: PLAN_LAP_SEC,
      conditions: 'dry',
      driftSec: 0,
      stops: [],
    });
    // Waiting, green and five laps: not one call per tick.
    expect(engine).toHaveBeenCalledTimes(7);
    expect(lastInput()).toMatchObject({
      actual: [
        {
          driverId: DRIVER_A,
          startLap: 0,
          startSec: 0,
          endLap: null,
          endSec: null,
        },
      ],
      teamLaps: 5,
      elapsedSec: 5 * PLAN_LAP_SEC,
      tankCapacity: 36,
      fuelPerLap: 1,
      lapTimeSec: PLAN_LAP_SEC,
      conditions: 'dry',
      remainingSec: 86_400 - sim.time,
    });
  });

  it('fills the box lap and current stint from the real engine', async () => {
    const actual = await vi.importActual<typeof import('./racePlanRebaseline')>(
      './racePlanRebaseline'
    );
    engine.mockImplementation(actual.rebaselinePlan);
    const { sim } = start();
    sim.driveLaps(5);
    sim.pit({ stallSec: 180 });
    sim.driveLaps(2);
    const snapshot = sim.snapshot;
    expect(snapshot.currentStintIndex).toBe(0);
    expect(snapshot.stints[0].status).toBe('current');
    expect(snapshot.boxLap).not.toBeNull();
    expect(snapshot.lapsUntilBox).toBe((snapshot.boxLap ?? 0) - 8);
    expect(snapshot.driftSec).not.toBeNull();
  });

  it('runs a planned stop and then an early damage stop through the real engine', async () => {
    const actual = await vi.importActual<typeof import('./racePlanRebaseline')>(
      './racePlanRebaseline'
    );
    engine.mockImplementation(actual.rebaselinePlan);
    const { sim } = start({ green: false });
    sim.fuel = 36;
    sim.green();
    const fuelPerLap = 1.05;

    sim.driveLaps(33, { fuelPerLap });
    expect(sim.snapshot.lapsUntilBox).toBe(0);
    sim.pit({ fuelAdd: 36 - sim.fuel, driverTo: DRIVER_B });
    sim.driveLaps(2, { fuelPerLap });
    const afterPlannedStop = sim.snapshot;
    expect(afterPlannedStop.currentStintIndex).toBe(1);
    expect(afterPlannedStop.stints[0]).toMatchObject({
      status: 'done',
      laps: 33,
      rebuilt: false,
    });
    expect(afterPlannedStop.stints[1]).toMatchObject({
      status: 'current',
      driverId: DRIVER_B,
      startLap: 33,
    });
    expect(afterPlannedStop.boxLap).toBe(33 + 34);
    expect(afterPlannedStop.stops.at(-1)).toMatchObject({
      lap: 33,
      driverChanged: true,
      unplanned: false,
    });
    expect(
      afterPlannedStop.stints.filter(
        (s) => s.status === 'upcoming' && s.rebuilt
      )
    ).toEqual([]);

    sim.driveLaps(5, { fuelPerLap });
    sim.pit({ stallSec: 120, fuelAdd: 36 - sim.fuel });
    sim.driveLaps(1, { fuelPerLap });
    const afterDamage = sim.snapshot;
    expect(afterDamage.stops.at(-1)).toMatchObject({
      lap: 40,
      driverChanged: false,
      unplanned: true,
    });
    expect(afterDamage.currentStintIndex).toBe(2);
    expect(afterDamage.stints[2]).toMatchObject({
      status: 'current',
      startLap: 40,
      driverId: DRIVER_B,
    });
    expect(afterDamage.boxLap).toBeGreaterThan(40 + 30);
    expect(afterDamage.boxLap).toBeLessThanOrEqual(40 + 34);
    const upcoming = afterDamage.stints.filter((s) => s.status === 'upcoming');
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((s) => s.rebuilt)).toBe(true);
  });

  it('needs three clean green-flag laps before reporting measurements', () => {
    const { sim } = start();
    // The start lap, a caution lap and the lap begun under it are left out.
    sim.lap();
    sim.lap({ flags: GlobalFlags.Caution });
    sim.driveLaps(3);
    expect(sim.snapshot.fuelPerLap).toBeNull();
    expect(sim.snapshot.lapTimeSec).toBeNull();
    sim.lap();
    expect(sim.snapshot.fuelPerLap).toBe(1);
    expect(sim.snapshot.lapTimeSec).toBe(PLAN_LAP_SEC);
  });

  it('keeps the stint and box lap through a long repair stop, and the drift shows the loss', () => {
    const { sim } = start();
    sim.driveLaps(5);
    sim.pit({ stallSec: 180 });
    sim.driveLaps(2);
    const snapshot = sim.snapshot;
    expect(snapshot.stops).toEqual([
      {
        lap: 5,
        elapsedSec: 5 * PLAN_LAP_SEC + 11,
        durationSec: 180,
        fuelAdded: 0,
        fuelAssumed: false,
        driverChanged: false,
        compoundChanged: false,
        unplanned: true,
      },
    ]);
    expect(snapshot.boxLap).toBe(BOX_AFTER_LAPS);
    expect(snapshot.lapsInStint).toBe(7);
    expect(lastInput().actual).toHaveLength(1);
    expect(lastInput().elapsedSec).toBe(7 * PLAN_LAP_SEC + 200);
    expect(snapshot.driftSec).toBe(200);
  });

  it('starts a new stint on a fuel stop with a driver change seen after the exit', () => {
    const { sim } = start();
    sim.driveLaps(3);
    sim.pit({
      stallSec: 40,
      fuelAdd: 20,
      driverTo: DRIVER_B,
      sessionDelaySec: 5,
    });
    sim.driveLaps(2);
    expect(sim.snapshot.stops).toMatchObject([
      { lap: 3, fuelAdded: 20, driverChanged: true, fuelAssumed: false },
    ]);
    expect(sim.snapshot.driverId).toBe(DRIVER_B);
    expect(sim.snapshot.currentStintIndex).toBe(1);
    expect(sim.snapshot.lapsInStint).toBe(2);
    expect(lastInput().actual).toEqual([
      {
        driverId: DRIVER_A,
        startLap: 0,
        startSec: 0,
        endLap: 3,
        endSec: 191,
        planIndex: 0,
        fueled: true,
      },
      {
        driverId: DRIVER_B,
        startLap: 3,
        startSec: 231,
        endLap: null,
        endSec: null,
        planIndex: 1,
        fueled: true,
      },
    ]);
  });

  it('starts a new stint on a driver change with no fuel, even when the session info lags', () => {
    const { sim } = start();
    sim.driveLaps(3);
    sim.pit({ stallSec: 40, driverTo: DRIVER_B, sessionDelaySec: 8 });
    expect(sim.snapshot.stops).toMatchObject([
      { lap: 3, fuelAdded: 0, driverChanged: true },
    ]);
    expect(lastInput().actual).toEqual([
      {
        driverId: DRIVER_A,
        startLap: 0,
        startSec: 0,
        endLap: 3,
        endSec: 191,
        planIndex: 0,
        fueled: true,
      },
      {
        driverId: DRIVER_B,
        startLap: 3,
        startSec: 231,
        endLap: null,
        endSec: null,
        planIndex: 1,
        fueled: false,
      },
    ]);
  });

  it('moves to the next plan stint on a planned fuel stop by the same driver', () => {
    const { sim } = start();
    sim.driveLaps(BOX_AFTER_LAPS - 2);
    sim.pit({ fuelAdd: 25 });
    expect(sim.snapshot.stops[0].unplanned).toBe(false);
    expect(lastInput().actual.at(-1)).toMatchObject({
      driverId: DRIVER_A,
      planIndex: 1,
      fueled: true,
    });
  });

  it('keeps the plan stint when an unplanned fuel stop splits it', () => {
    const { sim } = start();
    sim.driveLaps(4);
    sim.pit({ fuelAdd: 5 });
    expect(sim.snapshot.stops[0].unplanned).toBe(true);
    expect(
      lastInput().actual.map(({ planIndex, fueled }) => ({
        planIndex,
        fueled,
      }))
    ).toEqual([
      { planIndex: 0, fueled: true },
      { planIndex: 0, fueled: true },
    ]);
  });

  it('moves a split stint to the next plan slot when the swap shows late', () => {
    const { sim } = start();
    sim.driveLaps(4);
    sim.pit({ fuelAdd: 5, driverTo: DRIVER_B, sessionDelaySec: 8 });
    expect(lastInput().actual.at(-1)).toMatchObject({
      driverId: DRIVER_B,
      planIndex: 1,
      fueled: true,
    });
  });

  it('sees a swap made while the car is still in the stall', () => {
    const { sim } = start();
    sim.driveLaps(2);
    sim.pit({ stallSec: 40, driverTo: DRIVER_B, swapInStall: true });
    expect(sim.snapshot.stops).toMatchObject([{ driverChanged: true }]);
    expect(lastInput().actual.map((stint) => stint.driverId)).toEqual([
      DRIVER_A,
      DRIVER_B,
    ]);
  });

  it('advances a double stint on a fuel stop with the same driver', () => {
    const { sim } = start();
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 25, driverTo: DRIVER_B });
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 25 });
    sim.driveLaps(1);
    expect(sim.snapshot.stops.map((stop) => stop.driverChanged)).toEqual([
      true,
      false,
    ]);
    expect(lastInput().actual.map((stint) => stint.driverId)).toEqual([
      DRIVER_A,
      DRIVER_B,
      DRIVER_B,
    ]);
    expect(lastInput().actual[2].startLap).toBe(6);
    expect(sim.snapshot.currentStintIndex).toBe(2);
    expect(sim.snapshot.boxLap).toBe(6 + BOX_AFTER_LAPS);
  });

  it('starts a new stint from an early damage stop that adds fuel', () => {
    const { sim } = start();
    sim.driveLaps(4);
    sim.pit({ stallSec: 90, fuelAdd: 4 });
    sim.lap();
    expect(sim.snapshot.stops).toMatchObject([
      { lap: 4, fuelAdded: 4, unplanned: true, driverChanged: false },
    ]);
    expect(lastInput().actual).toHaveLength(2);
    expect(lastInput().actual[1]).toMatchObject({
      driverId: DRIVER_A,
      startLap: 4,
    });
    expect(sim.snapshot.boxLap).toBe(4 + BOX_AFTER_LAPS);
  });

  it('passes the real fuel level after a partial fill', () => {
    const { sim } = start();
    sim.driveLaps(5);
    sim.pit({ stallSec: 12, fuelAdd: 6 });
    sim.lap();
    expect(sim.snapshot.stops[0].fuelAdded).toBe(6);
    expect(lastInput().fuelLevel).toBeCloseTo(30 - 6 + 6);
    expect(sim.snapshot.fuelLevel).toBeCloseTo(30);
  });

  it('re-measures in the wet and again back on slicks', () => {
    const { sim } = start();
    sim.driveLaps(4);
    expect(sim.snapshot.fuelPerLap).toBe(1);
    sim.pit({ fuelAdd: 10, compoundTo: 1 });
    expect(sim.snapshot.conditions).toBe('wet');
    expect(sim.snapshot.stops[0].compoundChanged).toBe(true);
    expect(sim.snapshot.fuelPerLap).toBeNull();
    expect(lastInput().conditions).toBe('wet');

    sim.driveLaps(4, { lapSec: 70, fuelPerLap: 1.2 });
    expect(sim.snapshot.fuelPerLap).toBe(1.2);
    expect(sim.snapshot.lapTimeSec).toBe(70);
    expect(lastInput()).toMatchObject({
      conditions: 'wet',
      fuelPerLap: 1.2,
      lapTimeSec: 70,
    });

    sim.pit({ fuelAdd: 10, compoundTo: 0 });
    expect(sim.snapshot.conditions).toBe('dry');
    expect(sim.snapshot.fuelPerLap).toBeNull();
    sim.driveLaps(4);
    expect(sim.snapshot.fuelPerLap).toBe(1);
  });

  it('assumes a full tank at a long stop when the fuel level cannot be seen', () => {
    const { sim } = start();
    sim.fuelVisible = false;
    sim.driveLaps(4);
    expect(sim.snapshot).toMatchObject({
      fuelVisible: false,
      fuelLevel: null,
      fuelPerLap: null,
      lapTimeSec: PLAN_LAP_SEC,
    });
    sim.pit({ stallSec: 30 });
    expect(sim.snapshot.stops).toMatchObject([
      { fuelAdded: null, fuelAssumed: true },
    ]);
    expect(lastInput().actual).toHaveLength(2);
    expect(lastInput().fuelLevel).toBeNull();

    sim.pit({ stallSec: 10 });
    expect(sim.snapshot.stops[1]).toMatchObject({
      fuelAdded: null,
      fuelAssumed: false,
    });
    expect(lastInput().actual).toHaveLength(2);
  });

  it('rebuilds from a newer plan and keeps the actual history', () => {
    let selection = fixturePlan();
    const { sim } = start({ plan: () => selection });
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 20, driverTo: DRIVER_B });
    const before = lastInput().actual;
    const calls = engine.mock.calls.length;

    selection = {
      ...selection,
      strategy: { ...selection.strategy, updatedAt: '2030-06-01T15:00:00Z' },
    };
    sim.tick();
    expect(engine.mock.calls.length).toBe(calls + 1);
    expect(lastInput().strategy.updatedAt).toBe('2030-06-01T15:00:00Z');
    expect(lastInput().actual).toEqual(before);
    expect(sim.snapshot.planUpdatedAt).toBe('2030-06-01T15:00:00Z');
    expect(sim.snapshot.stops).toHaveLength(1);
  });

  it('saves the history and resumes it after a restart', () => {
    const persistence = memoryPersistence();
    const { sim } = start({ persistence });
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 20, driverTo: DRIVER_B });
    sim.driveLaps(2);
    const before = sim.snapshot;
    const actual = lastInput().actual;
    expect(persistence.records.get(SUB_SESSION_ID)).toMatchObject({
      sessionNum: RACE_SESSION,
      raceStartMs: before.raceStartMs,
      finished: false,
      stops: before.stops,
    });

    const restarted = new RacePlanProgressProcessor({
      getPlan: fixturePlan,
      persistence,
      now: () => CLOCK_BASE_MS + sim.time * 1000,
    });
    sim.processor = restarted;
    restarted.init(makeSession(sim.sessionOptions));
    sim.lap();
    expect(persistence.load).toHaveBeenCalledWith(SUB_SESSION_ID);
    expect(restarted.snapshot()).toMatchObject({
      status: 'racing',
      raceStartMs: before.raceStartMs,
      elapsedSec: before.elapsedSec + PLAN_LAP_SEC,
      teamLaps: 6,
      driverId: DRIVER_B,
      stops: before.stops,
    });
    expect(lastInput().actual).toEqual(actual);
  });

  it('tracks nothing and writes nothing in a replay', () => {
    const persistence = memoryPersistence();
    const { sim } = start({ persistence, sourceReplay: true });
    sim.driveLaps(2);
    sim.pit({ fuelAdd: 10 });
    expect(sim.snapshot.status).toBe('replay');
    expect(sim.snapshot.stops).toEqual([]);
    expect(engine).not.toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
    expect(persistence.load).not.toHaveBeenCalled();
  });

  it('tracks nothing and writes nothing in a loaded replay file', () => {
    const persistence = memoryPersistence();
    const { sim } = start({ persistence, green: false });
    sim.setSession({ simMode: 'replay' });
    sim.green();
    sim.driveLaps(2);
    sim.pit({ fuelAdd: 10 });
    expect(sim.snapshot.status).toBe('replay');
    expect(sim.snapshot.stops).toEqual([]);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('keeps tracking a spectated race, where the sim reports replay playing', () => {
    const persistence = memoryPersistence();
    const { sim } = start({ persistence, green: false });
    sim.replay = true;
    sim.green();
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 20, driverTo: DRIVER_B, sessionDelaySec: 5 });
    sim.driveLaps(1);
    expect(sim.snapshot).toMatchObject({
      status: 'racing',
      teamLaps: 4,
      driverId: DRIVER_B,
      stops: [{ lap: 3, fuelAdded: 20, driverChanged: true }],
    });
    expect(lastInput().actual.map((stint) => stint.driverId)).toEqual([
      DRIVER_A,
      DRIVER_B,
    ]);
    expect(persistence.save).toHaveBeenCalled();
  });

  it('ignores a replay rewind: no repeated stops, laps never go back', () => {
    const { sim } = start();
    sim.replay = true;
    sim.driveLaps(3);
    sim.pit({ fuelAdd: 20 });
    sim.lap();
    const live = { time: sim.time, laps: sim.laps, fuel: sim.fuel };

    sim.time = live.time - 300;
    sim.laps = 2;
    sim.pit({ fuelAdd: 20, driverTo: DRIVER_B });
    sim.setDriver(DRIVER_A);
    expect(sim.snapshot.teamLaps).toBe(4);

    Object.assign(sim, live);
    sim.lap();
    expect(sim.snapshot.stops).toHaveLength(1);
    expect(sim.snapshot.teamLaps).toBe(5);
    expect(lastInput().actual).toHaveLength(2);
    expect(lastInput().actual[1].driverId).toBe(DRIVER_A);
  });

  it('keeps the lap count while the car is not in the world', () => {
    const { sim } = start();
    sim.driveLaps(5);
    sim.pit({ fuelAdd: 20 });
    sim.driveLaps(2);
    sim.surface = TrackLocation.NotInWorld;
    sim.lapCountOverride = -1;
    sim.tick(5);
    sim.setDriver(DRIVER_B);
    sim.tick(5);
    expect(sim.snapshot.teamLaps).toBe(7);
    expect(lastInput().teamLaps).toBe(7);
    expect(lastInput().actual).toHaveLength(3);
    expect(lastInput().actual[2]).toMatchObject({
      driverId: DRIVER_B,
      startLap: 7,
      fueled: false,
    });
    expect(lastInput().actual[1]).toMatchObject({ startLap: 5, endLap: 7 });
  });

  it('flags a plan made for another team or track', () => {
    const { sim } = start();
    sim.processor.init(makeSession({ teamId: 1234, trackId: 99 }));
    sim.tick();
    expect(sim.snapshot.mismatches).toEqual(['team', 'track']);
    sim.processor.init(makeSession({ trackId: 99 }));
    sim.tick();
    expect(sim.snapshot.mismatches).toEqual(['track']);
    sim.processor.init(makeSession());
    sim.tick();
    expect(sim.snapshot.mismatches).toEqual([]);
  });

  it('closes the last stint at the checkered flag', () => {
    const persistence = memoryPersistence();
    const { sim } = start({ persistence });
    sim.driveLaps(2);
    sim.state = SessionState.Checkered;
    sim.tick();
    expect(sim.snapshot.status).toBe('finished');
    expect(lastInput().actual[0]).toMatchObject({ endLap: 2 });
    expect(lastInput().remainingSec).toBe(0);
    expect(persistence.records.get(SUB_SESSION_ID)?.finished).toBe(true);
  });

  it('bumps the version only when something changed', () => {
    const { sim } = start();
    sim.driveLaps(1);
    const { version } = sim.snapshot;
    const frame = sim.frame();
    sim.processor.onFrame(frame);
    sim.processor.onFrame(frame);
    expect(sim.snapshot.version).toBe(version);
    sim.tick();
    expect(sim.snapshot.version).toBe(version + 1);
  });

  it(`keeps at most ${MAX_RACE_PLAN_STOPS} stops`, () => {
    const { sim } = start();
    for (let i = 0; i < MAX_RACE_PLAN_STOPS + 6; i += 1) {
      sim.pit({ stallSec: 2, pitRoadSec: 1 });
    }
    expect(sim.snapshot.stops).toHaveLength(MAX_RACE_PLAN_STOPS);
  });

  it('resets on disconnect', () => {
    const { sim, processor } = start();
    sim.driveLaps(2);
    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot()).toMatchObject({
      status: 'no-plan',
      teamLaps: 0,
      stops: [],
    });
  });
});
