import {
  GlobalFlags,
  SessionState,
  TrackLocation,
  type RacePlanConditions,
  type RacePlanMismatch,
  type RacePlanProgressSnapshot,
  type RacePlanProgressStatus,
  type RacePlanProjectedStint,
  type RacePlanStop,
  type RacePlanStrategy,
  type RacePlanning,
  type Session,
  type SessionLifecycleEvent,
  type Telemetry,
} from '@irdashies/types';
import type {
  RacePlanHistoryRecord,
  RacePlanHistoryStint,
} from '../storage/racePlanHistory';
import type { TelemetryProcessor } from './TelemetryProcessor';
import { rebaselinePlan, type RebaselineResult } from './racePlanRebaseline';

/** Litres the level must rise in the stall to count as a fuel stop. */
const FUEL_ADDED_MIN = 0.5;
/** Without visible fuel, a stall stop at least this long assumes a full tank. */
export const ASSUMED_FILL_MIN_STOP_SEC = 20;
/** Session info can lag the stall exit; changes this soon after belong to it. */
export const POST_STOP_GRACE_SEC = 60;
/** A stop more than this many laps before the box lap is unplanned. */
const UNPLANNED_WINDOW_LAPS = 3;
const MIN_MEASURED_LAPS = 3;
const MEASURED_WINDOW_LAPS = 5;
export const MAX_RACE_PLAN_STOPS = 64;
const MAX_STINTS = 64;
/** A jump in session time longer than this is a gap: stale stop state goes. */
const FRAME_GAP_SEC = 10;
/** iRacing's SessionTimeRemain for a session with no time limit. */
const UNLIMITED_TIME_REMAIN = 604800;
const CAUTION_FLAGS =
  GlobalFlags.Caution | GlobalFlags.CautionWaving | GlobalFlags.Red;
const WET_COMPOUND = /wet|rain/i;

export interface RacePlanSelection {
  planning: RacePlanning;
  strategy: RacePlanStrategy;
}

export interface RacePlanHistoryPersistence {
  load(subSessionId: number): RacePlanHistoryRecord | null;
  save(record: RacePlanHistoryRecord): void;
}

export interface RacePlanProgressProcessorOptions {
  getPlan: () => RacePlanSelection | null;
  persistence?: RacePlanHistoryPersistence;
  /** Epoch milliseconds. */
  now?: () => number;
  sourceReplay?: boolean;
}

export const noRacePlanHistory: RacePlanHistoryPersistence = {
  load: () => null,
  save: () => undefined,
};

interface RaceState {
  sessionNum: number;
  greenSessionTime: number;
  raceStartMs: number;
  finished: boolean;
}

interface OpenStop {
  lap: number;
  entrySessionTime: number;
  entryElapsed: number;
  entryFuel: number | null;
  maxFuel: number | null;
  driverId: number | null;
  compound: number | null;
  unplanned: boolean;
}

interface StopExit {
  sessionTime: number;
  newStint: boolean;
}

interface LapState {
  startFuel: number | null;
  dirty: boolean;
}

const MISMATCHES: readonly RacePlanMismatch[][] = [
  [],
  ['team'],
  ['track'],
  ['team', 'track'],
];
const NO_STINTS: RacePlanProjectedStint[] = [];
const SNAPSHOT_KEYS: readonly (keyof RacePlanProgressSnapshot)[] = [
  'status',
  'planningId',
  'strategyId',
  'planUpdatedAt',
  'mismatches',
  'raceStartMs',
  'elapsedSec',
  'teamLaps',
  'driverId',
  'currentStintIndex',
  'lapsInStint',
  'boxLap',
  'lapsUntilBox',
  'fuelLevel',
  'fuelVisible',
  'fuelPerLap',
  'lapTimeSec',
  'conditions',
  'driftSec',
  'stints',
  'stops',
];

const numberAt = (
  frame: Telemetry,
  key: keyof Telemetry,
  index = 0
): number | null => {
  const value = frame[key]?.value?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const flagAt = (frame: Telemetry, key: keyof Telemetry, index = 0) => {
  const value = frame[key]?.value?.[index];
  return value === true || value === 1;
};

const positiveIdOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const planKeyOf = (plan: RacePlanSelection | null): string | null =>
  plan
    ? `${plan.planning.id}:${plan.strategy.id}:${plan.strategy.updatedAt}`
    : null;

/**
 * Tracks the team car against its race plan: race time, laps, stops, stint
 * boundaries and the measured fuel use and pace. A stint is one tank: a stall
 * stop that adds fuel, or a driver change, starts a new one. The rest of the
 * plan is rebuilt by `rebaselinePlan` on laps and events, not every tick.
 */
export class RacePlanProgressProcessor implements TelemetryProcessor<
  RacePlanProgressSnapshot,
  'race-plan.progress'
> {
  readonly channel = 'race-plan.progress';
  readonly tickRateHz = 1;

  private readonly getPlan: () => RacePlanSelection | null;
  private readonly persistence: RacePlanHistoryPersistence;
  private readonly now: () => number;
  private sourceReplay: boolean;
  /** A loaded replay file (`WeekendInfo.SimMode`), not live spectating. */
  private simReplay = false;

  private session?: Session;
  private teamCarIdx = -1;
  private driverId: number | null = null;
  private teamId: number | null = null;
  private trackId: number | null = null;
  private subSessionId: number | null = null;
  private tankCapacity: number | null = null;
  private compoundNames: string[] = [];
  private readonly sessionTypes = new Map<number, string>();

  private race: RaceState | null = null;
  private preGreenSessionNum: number | null = null;
  private stints: RacePlanHistoryStint[] = [];
  private stops: RacePlanStop[] = [];
  private openStop: OpenStop | null = null;
  private lastStopExit: StopExit | null = null;
  private lastTeamLaps: number | null = null;
  private lastDriverId: number | null = null;
  private lastCompound: number | null = null;
  private lastFuel: number | null = null;
  private lap: LapState = { startFuel: null, dirty: true };
  private conditions: RacePlanConditions = 'dry';
  private readonly fuelSamples: number[] = [];
  private readonly lapTimeSamples: number[] = [];
  private planKey: string | null = null;
  private result: RebaselineResult | null = null;
  private pendingEvent = true;
  private highWaterSessionNum: number | null = null;
  private highWaterSessionTime: number | null = null;
  private rewound = false;
  private lapsSessionNum: number | null = null;
  private teamLapsHigh = 0;
  private latest: RacePlanProgressSnapshot;

  constructor(options: RacePlanProgressProcessorOptions) {
    this.getPlan = options.getPlan;
    this.persistence = options.persistence ?? noRacePlanHistory;
    this.now = options.now ?? Date.now;
    this.sourceReplay = options.sourceReplay ?? false;
    this.latest = this.emptySnapshot(0);
  }

  init(session: Session): void {
    this.session = session;
    const driverInfo = session.DriverInfo;
    this.teamCarIdx = driverInfo?.DriverCarIdx ?? -1;
    const teamDriver = driverInfo?.Drivers?.find(
      (driver) => driver.CarIdx === this.teamCarIdx
    );
    this.driverId = positiveIdOrNull(teamDriver?.UserID);
    this.teamId =
      typeof teamDriver?.TeamID === 'number' ? teamDriver.TeamID : null;
    this.trackId = positiveIdOrNull(session.WeekendInfo?.TrackID);
    const maxFuel = driverInfo?.DriverCarFuelMaxLtr;
    const maxFuelPct = driverInfo?.DriverCarMaxFuelPct;
    this.tankCapacity =
      typeof maxFuel === 'number' && maxFuel > 0
        ? round(
            maxFuel *
              (typeof maxFuelPct === 'number' && maxFuelPct > 0
                ? maxFuelPct
                : 1),
            2
          )
        : null;
    this.compoundNames = [];
    for (const tire of driverInfo?.DriverTires ?? []) {
      if (Number.isInteger(tire?.TireIndex) && tire.TireIndex >= 0) {
        this.compoundNames[tire.TireIndex] = tire.TireCompoundType ?? '';
      }
    }
    this.sessionTypes.clear();
    for (const entry of session.SessionInfo?.Sessions ?? []) {
      this.sessionTypes.set(entry.SessionNum, entry.SessionType);
    }
    const subSessionId = positiveIdOrNull(session.WeekendInfo?.SubSessionID);
    const simReplay = session.WeekendInfo?.SimMode === 'replay';
    if (subSessionId !== this.subSessionId || simReplay !== this.simReplay) {
      this.subSessionId = subSessionId;
      this.simReplay = simReplay;
      this.resetRace();
      this.restore();
    }
  }

  onFrame(frame: Telemetry): void {
    const plan = this.getPlan();
    const planKey = planKeyOf(plan);
    if (planKey !== this.planKey) {
      this.planKey = planKey;
      this.pendingEvent = true;
      if (!plan) this.result = null;
    }
    // Not gated on IsReplayPlaying: a spectator in a live race reports it for
    // the whole race, and spectating teammates are the main audience.
    if (this.isReplay()) {
      this.publish({
        ...this.latest,
        ...this.planFields(plan),
        status: plan ? 'replay' : 'no-plan',
      });
      return;
    }

    const sessionTime = numberAt(frame, 'SessionTime') ?? 0;
    const sessionNum = numberAt(frame, 'SessionNum') ?? 0;
    if (!this.advanceHighWater(sessionNum, sessionTime)) return;
    const sessionState = numberAt(frame, 'SessionState') ?? 0;
    const car = this.teamCarIdx;
    const hasCar = car >= 0;
    const teamLaps = hasCar ? this.teamLapsOf(frame, car, sessionNum) : 0;
    const surface = hasCar
      ? (numberAt(frame, 'CarIdxTrackSurface', car) ?? TrackLocation.NotInWorld)
      : TrackLocation.NotInWorld;
    const compoundRaw = hasCar
      ? numberAt(frame, 'CarIdxTireCompound', car)
      : null;
    const compound =
      compoundRaw !== null && compoundRaw >= 0 ? compoundRaw : null;
    const fuelRaw = numberAt(frame, 'FuelLevel');
    const fuel = fuelRaw !== null && fuelRaw > 0 ? fuelRaw : null;

    let event = this.pendingEvent;
    this.pendingEvent = false;
    let lapCompleted = false;
    let persist = false;

    const isRace = hasCar && this.sessionTypes.get(sessionNum) === 'Race';
    if (isRace) {
      if (this.race && this.race.sessionNum !== sessionNum) this.resetRace();
      if (sessionState < SessionState.Racing) {
        this.preGreenSessionNum = sessionNum;
      } else if (!this.race && sessionState === SessionState.Racing) {
        this.goGreen(frame, sessionNum, sessionTime, teamLaps, fuel);
        event = true;
        persist = true;
      }
    }

    const race = this.race?.sessionNum === sessionNum ? this.race : null;
    const elapsed = race ? sessionTime - race.greenSessionTime : 0;

    if (race && !race.finished) {
      if (sessionState >= SessionState.Checkered) {
        race.finished = true;
        this.openStop = null;
        this.closeCurrentStint(teamLaps, elapsed);
        event = true;
        persist = true;
      } else {
        const tracked = this.trackRacing(
          frame,
          sessionTime,
          elapsed,
          teamLaps,
          surface,
          compound,
          fuel
        );
        event ||= tracked.event;
        persist ||= tracked.persist;
        lapCompleted = tracked.lapCompleted;
      }
    } else if (race?.finished && teamLaps > (this.lastTeamLaps ?? teamLaps)) {
      // The last lap is completed after the checkered flag.
      this.lastTeamLaps = teamLaps;
      const last = this.stints.at(-1);
      if (last) {
        last.endLap = teamLaps;
        last.endSec = elapsed;
      }
      lapCompleted = true;
      persist = true;
    }

    const conditions = this.conditionsOf(compound, frame);
    if (conditions !== this.conditions) {
      this.conditions = conditions;
      this.resetMeasurements();
      event = true;
    }
    this.lastFuel = fuel;

    if (persist) this.persist();

    const remain = numberAt(frame, 'SessionTimeRemain');
    const remainingSec = race?.finished
      ? 0
      : race && remain !== null && remain >= 0 && remain < UNLIMITED_TIME_REMAIN
        ? remain
        : null;
    const planElapsed = plan
      ? race
        ? elapsed
        : (this.now() - plan.strategy.raceStartMs) / 1000
      : 0;

    if (plan && (event || lapCompleted || !this.result)) {
      this.result = rebaselinePlan({
        strategy: plan.strategy,
        actual: race ? this.stints.map((stint) => ({ ...stint })) : [],
        teamLaps: race ? teamLaps : 0,
        elapsedSec: Math.max(0, planElapsed),
        remainingSec,
        fuelLevel: fuel,
        tankCapacity: this.tankCapacity,
        fuelPerLap: this.fuelPerLap(),
        lapTimeSec: this.lapTimeSec(),
        conditions: this.conditions,
      });
    }

    this.publish(
      this.buildSnapshot(plan, race, planElapsed, teamLaps, fuel, this.result)
    );
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.sourceReplay = event.replay;
      this.subSessionId = null;
      this.resetRace();
      if (this.session) this.init(this.session);
      this.publish(this.emptySnapshot(this.latest.version));
      return;
    }
    if (event.type === 'sessionNumChange') {
      this.dropStaleState();
      this.lastTeamLaps = null;
      this.preGreenSessionNum = null;
      return;
    }
    this.session = undefined;
    this.teamCarIdx = -1;
    this.subSessionId = null;
    this.sessionTypes.clear();
    this.resetRace();
    this.publish(this.emptySnapshot(this.latest.version));
  }

  snapshot(): RacePlanProgressSnapshot {
    return this.latest;
  }

  private goGreen(
    frame: Telemetry,
    sessionNum: number,
    sessionTime: number,
    teamLaps: number,
    fuel: number | null
  ): void {
    const sawStart = this.preGreenSessionNum === sessionNum;
    const elapsedAtGreen = sawStart ? 0 : this.elapsedBeforeJoin(frame);
    this.race = {
      sessionNum,
      greenSessionTime: sessionTime - elapsedAtGreen,
      raceStartMs: Math.round(this.now() - elapsedAtGreen * 1000),
      finished: false,
    };
    this.stints = [
      {
        driverId: this.driverId,
        startLap: sawStart ? teamLaps : 0,
        startSec: 0,
        endLap: null,
        endSec: null,
        planIndex: 0,
        fueled: true,
      },
    ];
    this.stops = [];
    this.lastTeamLaps = teamLaps;
    this.lastDriverId = this.driverId;
    // The start lap is not a clean lap.
    this.lap = { startFuel: fuel, dirty: true };
  }

  /** Joined after the green: the race clock is the best guess of elapsed. */
  private elapsedBeforeJoin(frame: Telemetry): number {
    const total = numberAt(frame, 'SessionTimeTotal');
    const remain = numberAt(frame, 'SessionTimeRemain');
    if (
      total === null ||
      remain === null ||
      remain < 0 ||
      remain >= UNLIMITED_TIME_REMAIN ||
      total < remain
    )
      return 0;
    return total - remain;
  }

  private isReplay(): boolean {
    return this.sourceReplay || this.simReplay;
  }

  /**
   * Skips frames at or behind the latest session time seen in this session, so
   * a spectator rewinding the replay does not record stops or laps twice.
   * Returns false for a frame to skip.
   */
  private advanceHighWater(sessionNum: number, sessionTime: number): boolean {
    if (sessionNum !== this.highWaterSessionNum) {
      this.highWaterSessionNum = sessionNum;
      this.highWaterSessionTime = null;
      this.rewound = false;
    }
    const high = this.highWaterSessionTime;
    if (high !== null && sessionTime <= high) {
      // An equal time is a paused sim, not a rewind.
      if (sessionTime < high) this.rewound = true;
      return false;
    }
    if (this.rewound || (high !== null && sessionTime - high > FRAME_GAP_SEC)) {
      this.rewound = false;
      this.dropStaleState();
    }
    this.highWaterSessionTime = sessionTime;
    return true;
  }

  /** After a gap, a rewind or a session change, nothing in flight is trusted. */
  private dropStaleState(): void {
    this.openStop = null;
    this.lastStopExit = null;
    this.lastFuel = null;
    this.lap = { startFuel: null, dirty: true };
    this.lastDriverId = this.stints.at(-1)?.driverId ?? null;
    this.pendingEvent = true;
  }

  /**
   * Laps completed by the team car. A negative count (not in the world) is
   * unknown, and the count never goes back within a session.
   */
  private teamLapsOf(frame: Telemetry, car: number, sessionNum: number) {
    if (sessionNum !== this.lapsSessionNum) {
      this.lapsSessionNum = sessionNum;
      this.teamLapsHigh = this.lapFloor();
    }
    const laps = numberAt(frame, 'CarIdxLapCompleted', car);
    if (laps !== null && laps > this.teamLapsHigh) this.teamLapsHigh = laps;
    return this.teamLapsHigh;
  }

  private lapFloor(): number {
    const last = this.stints.at(-1);
    return last ? (last.endLap ?? last.startLap) : 0;
  }

  private trackRacing(
    frame: Telemetry,
    sessionTime: number,
    elapsed: number,
    teamLaps: number,
    surface: number,
    compound: number | null,
    fuel: number | null
  ): { event: boolean; persist: boolean; lapCompleted: boolean } {
    let event = false;
    let persist = false;
    let lapCompleted = false;
    const inStall = surface === TrackLocation.InPitStall;

    if (this.openStop) {
      if (inStall || surface === TrackLocation.NotInWorld) {
        if (fuel !== null) {
          this.openStop.maxFuel = Math.max(this.openStop.maxFuel ?? fuel, fuel);
        }
      } else {
        this.closeStop(this.openStop, sessionTime, elapsed, compound, fuel);
        this.openStop = null;
        event = true;
        persist = true;
      }
    } else if (inStall) {
      this.openStop = this.startStop(
        sessionTime,
        elapsed,
        teamLaps,
        compound,
        fuel
      );
    }

    const driverId = this.driverId;
    const current = this.stints.at(-1);
    if (driverId !== null && driverId !== this.lastDriverId) {
      if (current && current.driverId === null && this.lastDriverId === null) {
        current.driverId = driverId;
        persist = true;
      } else if (!this.openStop) {
        this.driverChanged(driverId, sessionTime, elapsed, teamLaps);
        event = true;
        persist = true;
      }
      this.lastDriverId = driverId;
    }

    if (compound !== null && compound !== this.lastCompound) {
      if (this.lastCompound !== null) {
        this.resetMeasurements();
        event = true;
        if (!this.openStop && this.recentStop(sessionTime)) {
          persist = this.markLastStop({ compoundChanged: true }) || persist;
        }
      }
      this.lastCompound = compound;
    }

    if (this.lastTeamLaps === null || teamLaps < this.lastTeamLaps) {
      this.lastTeamLaps = teamLaps;
      this.lap = { startFuel: fuel, dirty: true };
    } else if (teamLaps > this.lastTeamLaps) {
      if (teamLaps - this.lastTeamLaps === 1 && !this.lap.dirty) {
        this.measureLap(frame, fuel);
      }
      this.lastTeamLaps = teamLaps;
      this.lap = { startFuel: fuel, dirty: false };
      lapCompleted = true;
    }
    const flags = numberAt(frame, 'SessionFlags') ?? 0;
    if (
      inStall ||
      flagAt(frame, 'CarIdxOnPitRoad', this.teamCarIdx) ||
      (flags & CAUTION_FLAGS) !== 0 ||
      surface === TrackLocation.NotInWorld
    ) {
      this.lap.dirty = true;
    }
    return { event, persist, lapCompleted };
  }

  private startStop(
    sessionTime: number,
    elapsed: number,
    teamLaps: number,
    compound: number | null,
    fuel: number | null
  ): OpenStop {
    // Refuelling may already have begun by the first sample in the stall.
    const entryFuel =
      fuel !== null && this.lastFuel !== null
        ? Math.min(fuel, this.lastFuel)
        : fuel;
    const boxLap = this.result?.boxLap ?? null;
    return {
      lap: teamLaps,
      entrySessionTime: sessionTime,
      entryElapsed: elapsed,
      entryFuel,
      maxFuel: fuel,
      driverId: this.driverId,
      compound,
      unplanned:
        boxLap !== null && boxLap - (teamLaps + 1) > UNPLANNED_WINDOW_LAPS,
    };
  }

  private closeStop(
    open: OpenStop,
    sessionTime: number,
    elapsed: number,
    compound: number | null,
    fuel: number | null
  ): void {
    const duration = sessionTime - open.entrySessionTime;
    const maxFuel =
      fuel !== null && open.maxFuel !== null
        ? Math.max(open.maxFuel, fuel)
        : open.maxFuel;
    let fuelAdded: number | null = null;
    let fuelAssumed = false;
    if (open.entryFuel !== null && maxFuel !== null) {
      fuelAdded = round(Math.max(0, maxFuel - open.entryFuel), 2);
    } else if (duration >= ASSUMED_FILL_MIN_STOP_SEC) {
      fuelAssumed = true;
    }
    const driverChanged =
      this.driverId !== null &&
      open.driverId !== null &&
      this.driverId !== open.driverId;
    const compoundChanged =
      compound !== null && open.compound !== null && compound !== open.compound;
    this.pushStop({
      lap: open.lap,
      elapsedSec: round(open.entryElapsed, 1),
      durationSec: round(duration, 1),
      fuelAdded,
      fuelAssumed,
      driverChanged,
      compoundChanged,
      unplanned: open.unplanned,
    });
    const fueled = fuelAssumed || (fuelAdded ?? 0) >= FUEL_ADDED_MIN;
    const newStint = fueled || driverChanged;
    if (newStint) {
      // An unplanned fuel stop by the same driver splits the plan stint.
      const nextSlot = driverChanged || !open.unplanned;
      this.startStint(
        open.lap,
        open.entryElapsed,
        elapsed,
        this.driverId,
        this.planIndex() + (nextSlot ? 1 : 0),
        fueled
      );
    }
    this.lastStopExit = { sessionTime, newStint };
    this.lastDriverId = this.driverId ?? this.lastDriverId;
    this.lap.dirty = true;
  }

  private driverChanged(
    driverId: number,
    sessionTime: number,
    elapsed: number,
    teamLaps: number
  ): void {
    const exit = this.recentStop(sessionTime) ? this.lastStopExit : null;
    const stop = this.stops.at(-1);
    if (!exit || !stop) {
      this.startStint(
        teamLaps,
        elapsed,
        elapsed,
        driverId,
        this.planIndex() + 1,
        false
      );
      return;
    }
    this.markLastStop({ driverChanged: true });
    const current = this.stints.at(-1);
    if (exit.newStint && current) {
      // The stop's stint is a new driver's, so it takes the next plan slot.
      current.driverId = driverId;
      current.planIndex = (this.stints.at(-2)?.planIndex ?? -1) + 1;
      return;
    }
    // The swap is part of the stop: the new stint starts at its exit.
    this.startStint(
      stop.lap,
      stop.elapsedSec,
      stop.elapsedSec + stop.durationSec,
      driverId,
      this.planIndex() + 1,
      false
    );
    exit.newStint = true;
  }

  private recentStop(sessionTime: number): boolean {
    return (
      this.lastStopExit !== null &&
      sessionTime - this.lastStopExit.sessionTime <= POST_STOP_GRACE_SEC
    );
  }

  /** Returns true when the last stop changed. */
  private markLastStop(
    change: Partial<Pick<RacePlanStop, 'driverChanged' | 'compoundChanged'>>
  ): boolean {
    const last = this.stops.at(-1);
    if (!last) return false;
    const next = { ...last, ...change };
    if (
      next.driverChanged === last.driverChanged &&
      next.compoundChanged === last.compoundChanged
    )
      return false;
    this.stops = [...this.stops.slice(0, -1), next];
    return true;
  }

  private pushStop(stop: RacePlanStop): void {
    this.stops = [...this.stops, stop].slice(-MAX_RACE_PLAN_STOPS);
  }

  private planIndex(): number {
    return this.stints.at(-1)?.planIndex ?? 0;
  }

  private startStint(
    lap: number,
    endSec: number,
    startSec: number,
    driverId: number | null,
    planIndex: number,
    fueled: boolean
  ): void {
    this.closeCurrentStint(lap, endSec);
    this.stints.push({
      driverId,
      startLap: lap,
      startSec: round(startSec, 1),
      endLap: null,
      endSec: null,
      planIndex,
      fueled,
    });
    if (this.stints.length > MAX_STINTS) this.stints.shift();
  }

  private closeCurrentStint(lap: number, endSec: number): void {
    const current = this.stints.at(-1);
    if (current && current.endLap === null) {
      current.endLap = lap;
      current.endSec = round(endSec, 1);
    }
  }

  private measureLap(frame: Telemetry, fuel: number | null): void {
    const lapTime = numberAt(frame, 'CarIdxLastLapTime', this.teamCarIdx);
    if (lapTime !== null && lapTime > 0) {
      this.lapTimeSamples.push(lapTime);
      if (this.lapTimeSamples.length > MEASURED_WINDOW_LAPS) {
        this.lapTimeSamples.shift();
      }
    }
    const used =
      fuel !== null && this.lap.startFuel !== null
        ? this.lap.startFuel - fuel
        : null;
    if (used !== null && used > 0) {
      this.fuelSamples.push(used);
      if (this.fuelSamples.length > MEASURED_WINDOW_LAPS) {
        this.fuelSamples.shift();
      }
    }
  }

  private resetMeasurements(): void {
    this.fuelSamples.length = 0;
    this.lapTimeSamples.length = 0;
    this.lap.dirty = true;
  }

  private fuelPerLap(): number | null {
    return this.fuelSamples.length >= MIN_MEASURED_LAPS
      ? round(mean(this.fuelSamples), 3)
      : null;
  }

  /** Median, so one slow lap (traffic, a spin) does not skew the pace. */
  private lapTimeSec(): number | null {
    return this.lapTimeSamples.length >= MIN_MEASURED_LAPS
      ? round(median(this.lapTimeSamples), 3)
      : null;
  }

  private conditionsOf(
    compound: number | null,
    frame: Telemetry
  ): RacePlanConditions {
    const name = compound !== null ? this.compoundNames[compound] : undefined;
    if (name) return WET_COMPOUND.test(name) ? 'wet' : 'dry';
    return flagAt(frame, 'WeatherDeclaredWet') ? 'wet' : 'dry';
  }

  private restore(): void {
    if (this.subSessionId === null || this.isReplay()) return;
    const record = this.persistence.load(this.subSessionId);
    if (!record || record.stints.length === 0) return;
    this.race = {
      sessionNum: record.sessionNum,
      greenSessionTime: record.greenSessionTime,
      raceStartMs: record.raceStartMs,
      finished: record.finished,
    };
    this.stints = record.stints.map((stint) => ({ ...stint }));
    this.stops = record.stops.slice(-MAX_RACE_PLAN_STOPS);
    this.lastDriverId = this.stints.at(-1)?.driverId ?? null;
    this.pendingEvent = true;
  }

  private persist(): void {
    if (this.subSessionId === null || !this.race || this.isReplay()) return;
    this.persistence.save({
      subSessionId: this.subSessionId,
      sessionNum: this.race.sessionNum,
      greenSessionTime: this.race.greenSessionTime,
      raceStartMs: this.race.raceStartMs,
      finished: this.race.finished,
      stints: this.stints.map((stint) => ({ ...stint })),
      stops: this.stops,
    });
  }

  private resetRace(): void {
    this.race = null;
    this.preGreenSessionNum = null;
    this.stints = [];
    this.stops = [];
    this.openStop = null;
    this.lastStopExit = null;
    this.lastTeamLaps = null;
    this.lastDriverId = null;
    this.lastCompound = null;
    this.lastFuel = null;
    this.lap = { startFuel: null, dirty: true };
    this.conditions = 'dry';
    this.fuelSamples.length = 0;
    this.lapTimeSamples.length = 0;
    this.result = null;
    this.pendingEvent = true;
    this.lapsSessionNum = null;
    this.teamLapsHigh = 0;
    this.highWaterSessionNum = null;
    this.highWaterSessionTime = null;
    this.rewound = false;
  }

  private planFields(
    plan: RacePlanSelection | null
  ): Pick<
    RacePlanProgressSnapshot,
    'planningId' | 'strategyId' | 'planUpdatedAt' | 'mismatches'
  > {
    if (!plan) {
      return {
        planningId: null,
        strategyId: null,
        planUpdatedAt: null,
        mismatches: MISMATCHES[0],
      };
    }
    const { teamId, trackId } = plan.planning;
    const team =
      teamId !== null && this.teamId !== null && this.teamId !== teamId;
    const track =
      trackId !== null && this.trackId !== null && this.trackId !== trackId;
    return {
      planningId: plan.planning.id,
      strategyId: plan.strategy.id,
      planUpdatedAt: plan.strategy.updatedAt,
      mismatches: MISMATCHES[(team ? 1 : 0) + (track ? 2 : 0)],
    };
  }

  private buildSnapshot(
    plan: RacePlanSelection | null,
    race: RaceState | null,
    elapsed: number,
    teamLaps: number,
    fuel: number | null,
    result: RebaselineResult | null
  ): RacePlanProgressSnapshot {
    const status: RacePlanProgressStatus = !plan
      ? 'no-plan'
      : !race
        ? 'waiting'
        : race.finished
          ? 'finished'
          : 'racing';
    const current = race ? this.stints.at(-1) : undefined;
    const currentIndex = race
      ? (result?.stints.findIndex((stint) => stint.status === 'current') ?? -1)
      : -1;
    const boxLap = race ? (result?.boxLap ?? null) : null;
    return {
      status,
      ...this.planFields(plan),
      raceStartMs: plan
        ? race
          ? race.raceStartMs
          : plan.strategy.raceStartMs
        : null,
      elapsedSec: round(elapsed, 1),
      teamLaps: race ? teamLaps : 0,
      driverId: this.driverId,
      currentStintIndex: currentIndex >= 0 ? currentIndex : null,
      lapsInStint: current
        ? Math.max(0, (current.endLap ?? teamLaps) - current.startLap)
        : 0,
      boxLap,
      lapsUntilBox:
        boxLap !== null ? Math.max(0, boxLap - (teamLaps + 1)) : null,
      fuelLevel: fuel !== null ? round(fuel, 2) : null,
      fuelVisible: fuel !== null,
      fuelPerLap: this.fuelPerLap(),
      lapTimeSec: this.lapTimeSec(),
      conditions: this.conditions,
      driftSec: race ? (result?.driftSec ?? null) : null,
      stints: plan ? (result?.stints ?? NO_STINTS) : NO_STINTS,
      stops: this.stops,
      version: this.latest.version,
    };
  }

  /** Replaces the snapshot, bumping the version, only when it changed. */
  private publish(next: RacePlanProgressSnapshot): void {
    const changed = SNAPSHOT_KEYS.some((key) => next[key] !== this.latest[key]);
    if (!changed) return;
    this.latest = { ...next, version: this.latest.version + 1 };
  }

  private emptySnapshot(version: number): RacePlanProgressSnapshot {
    return {
      status: 'no-plan',
      planningId: null,
      strategyId: null,
      planUpdatedAt: null,
      mismatches: MISMATCHES[0],
      raceStartMs: null,
      elapsedSec: 0,
      teamLaps: 0,
      driverId: null,
      currentStintIndex: null,
      lapsInStint: 0,
      boxLap: null,
      lapsUntilBox: null,
      fuelLevel: null,
      fuelVisible: false,
      fuelPerLap: null,
      lapTimeSec: null,
      conditions: 'dry',
      driftSec: null,
      stints: NO_STINTS,
      stops: this.stops,
      version,
    };
  }
}
