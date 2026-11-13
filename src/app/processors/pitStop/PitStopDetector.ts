import { TrackLocation } from '@irdashies/types';
import { PitSvFlags } from '../../irsdk/types/enums';
import { forwardPct } from './pitStopModel';

/** Buckets per lap for each car's "last passed at" times. */
const BUCKETS = 400;
/** Larger jumps are teleports (tow, reset), not driving. */
const MAX_STEP_PCT = 0.1;
/** The car must have passed the window start this recently before entry. */
const MAX_APPROACH_SECONDS = 120;
/** Give up on an exit that never reaches the window end. */
const MAX_EXIT_SECONDS = 90;
/** Longer stops are left out: repairs after a crash, or the driver away. */
const MAX_STATIONARY_SECONDS = 600;
const FUEL_RISE_LITRES = 0.01;
const TYRE_BITS =
  PitSvFlags.LFTireChange |
  PitSvFlags.RFTireChange |
  PitSvFlags.LRTireChange |
  PitSvFlags.RRTireChange;

export interface DetectorFrame {
  time: number;
  pct: readonly number[];
  onPitRoad: readonly boolean[];
  surface: readonly number[];
  caution: boolean;
  playerCarIdx: number;
  pitstopActive: boolean;
  fuelLevel: number;
  pitSvFlags: number;
  repairLeft: number;
  playerTowing: boolean;
  /** Window margins around the lane, as lap fractions. */
  beforePct: number;
  afterPct: number;
}

export interface ServiceObservation {
  serviceSeconds: number;
  fuelAddedLitres: number;
  fuelSeconds: number | null;
  tyresChanged: number;
  repairSeconds: number;
  fastRepair: boolean;
  tearOff: boolean;
}

export interface CompletedStop {
  carIdx: number;
  entryPct: number;
  exitPct: number;
  windowStartPct: number;
  windowEndPct: number;
  windowSeconds: number;
  stationarySeconds: number;
  /** Caution, tow, driver swap, or a very long stop: not a clean sample. */
  tainted: boolean;
  /** A caution came out at some point between the window start and end. */
  caution: boolean;
  service: ServiceObservation | null;
}

export interface DetectorEvents {
  completed: CompletedStop[];
  playerEntered: boolean;
  playerExited: boolean;
}

interface CarStop {
  phase: 'inLane' | 'exiting';
  entryTime: number;
  entryPct: number;
  windowStartPct: number;
  windowStartTime: number;
  exitTime: number;
  exitPct: number;
  stationary: number;
  tainted: boolean;
  caution: boolean;
}

interface ServiceState {
  active: boolean;
  start: number;
  fuelStart: number;
  lastFuel: number;
  beforeFirstRise: number | null;
  lastRise: number | null;
  flags: number;
  repair: number;
  result: ServiceObservation | null;
}

const wrap01 = (value: number) => ((value % 1) + 1) % 1;

export class PitStopDetector {
  private readonly passed: Float64Array;
  private readonly prevPct: Float64Array;
  private readonly prevTime: Float64Array;
  private readonly prevOnPitRoad: Uint8Array;
  private readonly prevSurface: Int8Array;
  private readonly stops = new Map<number, CarStop>();
  private service: ServiceState = this.freshService();
  private lastServiceFrame = 0;
  private lastTime = NaN;
  private readonly events: DetectorEvents = {
    completed: [],
    playerEntered: false,
    playerExited: false,
  };

  constructor(private readonly maxCars = 64) {
    this.passed = new Float64Array(maxCars * BUCKETS);
    this.prevPct = new Float64Array(maxCars);
    this.prevTime = new Float64Array(maxCars);
    this.prevOnPitRoad = new Uint8Array(maxCars);
    this.prevSurface = new Int8Array(maxCars);
    this.reset();
  }

  reset(): void {
    this.passed.fill(NaN);
    this.prevPct.fill(-1);
    this.prevTime.fill(NaN);
    this.prevOnPitRoad.fill(0);
    this.prevSurface.fill(TrackLocation.NotInWorld);
    this.stops.clear();
    this.service = this.freshService();
    this.lastTime = NaN;
  }

  private freshService(): ServiceState {
    return {
      active: false,
      start: 0,
      fuelStart: 0,
      lastFuel: 0,
      beforeFirstRise: null,
      lastRise: null,
      flags: 0,
      repair: 0,
      result: null,
    };
  }

  update(frame: DetectorFrame): DetectorEvents {
    const events = this.events;
    events.completed.length = 0;
    events.playerEntered = false;
    events.playerExited = false;

    const dt =
      Number.isFinite(this.lastTime) && frame.time > this.lastTime
        ? frame.time - this.lastTime
        : 0;
    if (Number.isFinite(this.lastTime) && frame.time < this.lastTime) {
      this.reset();
    }

    const cars = Math.min(this.maxCars, frame.pct.length);
    for (let carIdx = 0; carIdx < cars; carIdx++) {
      this.updateCar(carIdx, frame, dt);
    }
    this.updateService(frame);
    this.lastTime = frame.time;
    return events;
  }

  private updateCar(carIdx: number, frame: DetectorFrame, dt: number) {
    const pct = frame.pct[carIdx];
    const surface = frame.surface[carIdx] ?? TrackLocation.NotInWorld;
    const onPitRoad = frame.onPitRoad[carIdx] ?? false;
    const wasOnPitRoad = this.prevOnPitRoad[carIdx] === 1;
    const prevSurface = this.prevSurface[carIdx];
    const isPlayer = carIdx === frame.playerCarIdx;
    const stop = this.stops.get(carIdx);
    const valid = pct >= 0 && surface !== TrackLocation.NotInWorld;

    if (stop) {
      if (frame.caution) stop.caution = true;
      if (frame.caution || !valid || (isPlayer && frame.playerTowing)) {
        stop.tainted = true;
      }
      if (surface === TrackLocation.InPitStall) stop.stationary += dt;
    }

    if (valid) this.recordPassing(carIdx, pct, frame.time);

    if (!wasOnPitRoad && onPitRoad && valid && !stop) {
      const approached =
        prevSurface === TrackLocation.OnTrack ||
        prevSurface === TrackLocation.ApproachingPits ||
        prevSurface === TrackLocation.OffTrack;
      const entryPct = this.prevPct[carIdx] >= 0 ? this.prevPct[carIdx] : pct;
      if (approached) {
        const windowStartPct = wrap01(entryPct - frame.beforePct);
        const windowStartTime = this.timeAt(carIdx, windowStartPct);
        this.stops.set(carIdx, {
          phase: 'inLane',
          entryTime: frame.time,
          entryPct,
          windowStartPct,
          windowStartTime,
          exitTime: NaN,
          exitPct: NaN,
          stationary: 0,
          caution: frame.caution,
          tainted:
            !Number.isFinite(windowStartTime) ||
            windowStartTime > frame.time ||
            frame.time - windowStartTime > MAX_APPROACH_SECONDS,
        });
        if (isPlayer) {
          this.events.playerEntered = true;
          this.service = this.freshService();
        }
      }
    }

    const current = this.stops.get(carIdx);
    if (current?.phase === 'inLane' && wasOnPitRoad && !onPitRoad) {
      current.phase = 'exiting';
      current.exitTime = frame.time;
      current.exitPct = valid ? pct : this.prevPct[carIdx];
      if (!valid) current.tainted = true;
      if (isPlayer) this.events.playerExited = true;
    }

    if (current?.phase === 'exiting' && valid) {
      const windowEndPct = wrap01(current.exitPct + frame.afterPct);
      const travelled = forwardPct(current.exitPct, pct);
      if (travelled >= frame.afterPct && travelled < 0.5) {
        const prevTravelled = forwardPct(current.exitPct, this.prevPct[carIdx]);
        const span = travelled - prevTravelled;
        const ratio =
          span > 0 && prevTravelled < frame.afterPct
            ? (frame.afterPct - prevTravelled) / span
            : 1;
        const prevTime = this.prevTime[carIdx];
        const crossing = Number.isFinite(prevTime)
          ? prevTime + ratio * (frame.time - prevTime)
          : frame.time;
        this.finish(carIdx, current, windowEndPct, crossing, isPlayer);
      } else if (frame.time - current.exitTime > MAX_EXIT_SECONDS) {
        this.stops.delete(carIdx);
      }
    }

    this.prevOnPitRoad[carIdx] = onPitRoad ? 1 : 0;
    this.prevSurface[carIdx] = surface;
    if (valid) {
      this.prevPct[carIdx] = pct;
      this.prevTime[carIdx] = frame.time;
    }
  }

  private finish(
    carIdx: number,
    stop: CarStop,
    windowEndPct: number,
    crossing: number,
    isPlayer: boolean
  ) {
    this.stops.delete(carIdx);
    const service = isPlayer ? this.service.result : null;
    if (isPlayer) this.service = this.freshService();
    this.events.completed.push({
      carIdx,
      entryPct: stop.entryPct,
      exitPct: stop.exitPct,
      windowStartPct: stop.windowStartPct,
      windowEndPct,
      windowSeconds: crossing - stop.windowStartTime,
      stationarySeconds: stop.stationary,
      caution: stop.caution,
      tainted: stop.tainted || stop.stationary > MAX_STATIONARY_SECONDS,
      service,
    });
  }

  private recordPassing(carIdx: number, pct: number, time: number) {
    const base = carIdx * BUCKETS;
    const bucket = Math.min(BUCKETS - 1, Math.floor(pct * BUCKETS));
    const prevPct = this.prevPct[carIdx];
    const prevTime = this.prevTime[carIdx];
    const step = prevPct >= 0 ? forwardPct(prevPct, pct) : 1;

    if (step > 0 && step <= MAX_STEP_PCT && Number.isFinite(prevTime)) {
      const prevBucket = Math.min(BUCKETS - 1, Math.floor(prevPct * BUCKETS));
      let b = (prevBucket + 1) % BUCKETS;
      for (let guard = 0; guard <= BUCKETS; guard++) {
        const bucketPct = b / BUCKETS;
        const along = forwardPct(prevPct, bucketPct);
        if (along > step) break;
        this.passed[base + b] = prevTime + (along / step) * (time - prevTime);
        if (b === bucket) break;
        b = (b + 1) % BUCKETS;
      }
    } else if (step > MAX_STEP_PCT) {
      this.passed[base + bucket] = time;
    }
  }

  /** When the car last passed `pct`, interpolated between buckets. */
  private timeAt(carIdx: number, pct: number): number {
    const base = carIdx * BUCKETS;
    const exact = pct * BUCKETS;
    const lower = Math.floor(exact) % BUCKETS;
    const upper = (lower + 1) % BUCKETS;
    const a = this.passed[base + lower];
    const b = this.passed[base + upper];
    if (!Number.isFinite(a)) return b;
    if (!Number.isFinite(b) || b < a) return a;
    return a + (exact - Math.floor(exact)) * (b - a);
  }

  private updateService(frame: DetectorFrame) {
    const state = this.service;
    if (!this.stops.has(frame.playerCarIdx)) return;

    if (frame.pitstopActive && !state.active) {
      state.active = true;
      state.start = frame.time;
      state.fuelStart = frame.fuelLevel;
      state.lastFuel = frame.fuelLevel;
      state.beforeFirstRise = null;
      state.lastRise = null;
      state.flags = frame.pitSvFlags;
      state.repair = Math.max(0, frame.repairLeft);
      state.result = null;
      this.lastServiceFrame = frame.time;
      return;
    }

    if (state.active && frame.pitstopActive) {
      if (frame.fuelLevel > state.lastFuel + FUEL_RISE_LITRES) {
        state.beforeFirstRise ??= this.lastServiceFrame;
        state.lastRise = frame.time;
      }
      state.lastFuel = Math.max(state.lastFuel, frame.fuelLevel);
      this.lastServiceFrame = frame.time;
      return;
    }

    if (state.active && !frame.pitstopActive) {
      state.active = false;
      const fuelAdded = Math.max(0, frame.fuelLevel - state.fuelStart);
      state.result = {
        serviceSeconds: frame.time - state.start,
        fuelAddedLitres: fuelAdded,
        fuelSeconds:
          state.beforeFirstRise !== null && state.lastRise !== null
            ? state.lastRise - state.beforeFirstRise
            : null,
        tyresChanged: state.flags & TYRE_BITS,
        repairSeconds: state.repair,
        fastRepair: (state.flags & PitSvFlags.FastRepair) !== 0,
        tearOff: (state.flags & PitSvFlags.WindshieldTearoff) !== 0,
      };
    }
  }
}
