import type {
  LapHistorySnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import {
  LAP_CROSSING_IN_PIT,
  LAP_CROSSING_LAPPED,
  LAP_CROSSING_OFF_TRACK,
  LAP_HISTORY_CAPACITY,
  TrackLocation,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

/** Car slots the buffers are sized for. iRacing's hard limit is 64. */
const MAX_CARS = 64;

/**
 * Retention cap: LAP_HISTORY_CAPACITY (300) crossings per car, held in a ring
 * buffer. Past 300 laps the oldest crossing is overwritten, so a long
 * endurance race keeps a rolling window of the most recent laps rather than
 * growing without bound. Four arrays of 64 x 300, allocated once at startup,
 * with no allocation per crossing.
 */
export class LapHistoryProcessor implements TelemetryProcessor<LapHistorySnapshot> {
  readonly channel = 'lap-history.snapshot';
  // Crossings are events, not samples - publish only when a lap completes.
  readonly tickRateHz = 'event' as const;

  private readonly capacity = LAP_HISTORY_CAPACITY;
  private readonly count = new Array<number>(MAX_CARS).fill(0);
  private readonly start = new Array<number>(MAX_CARS).fill(0);
  private readonly lap = zeroes(MAX_CARS * LAP_HISTORY_CAPACITY);
  private readonly sessionTime = zeroes(MAX_CARS * LAP_HISTORY_CAPACITY);
  private readonly classPosition = zeroes(MAX_CARS * LAP_HISTORY_CAPACITY);
  private readonly flags = zeroes(MAX_CARS * LAP_HISTORY_CAPACITY);

  /** Last seen lap per car, used to detect a crossing. -1 = no baseline yet. */
  private readonly previousLap = new Array<number>(MAX_CARS).fill(-1);

  private sessionNum: number | null = null;
  private version = 0;
  private enabled = true;
  private readonly latest: LapHistorySnapshot;

  constructor() {
    this.latest = {
      carCount: MAX_CARS,
      capacity: this.capacity,
      count: this.count,
      start: this.start,
      lap: this.lap,
      sessionTime: this.sessionTime,
      classPosition: this.classPosition,
      flags: this.flags,
      sessionNum: null,
      version: 0,
    };
  }

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;

    const carIdxLap = frame.CarIdxLap?.value;
    if (!Array.isArray(carIdxLap)) return;

    const sessionNum = numberValue(frame, 'SessionNum');
    if (sessionNum !== null && sessionNum !== this.sessionNum) {
      this.reset(sessionNum);
    }

    // SessionTime is on the no-round list - read it raw. Each crossing stores
    // an absolute reading, so sampling error never accumulates.
    const sessionTime = numberValue(frame, 'SessionTime') ?? 0;
    const classPositions = frame.CarIdxClassPosition?.value;
    const onPitRoad = frame.CarIdxOnPitRoad?.value;
    const trackSurface = frame.CarIdxTrackSurface?.value;

    let leaderLap = 0;
    for (const value of carIdxLap) {
      const lap = toInt(value);
      if (lap > leaderLap) leaderLap = lap;
    }

    let changed = false;
    const cars = Math.min(carIdxLap.length, MAX_CARS);
    for (let carIdx = 0; carIdx < cars; carIdx += 1) {
      const lap = toInt(carIdxLap[carIdx]);
      const previous = this.previousLap[carIdx];
      this.previousLap[carIdx] = lap;

      // A car with no baseline yet, or one that went backwards (tow, reset),
      // establishes a new baseline instead of recording a crossing.
      if (previous < 0 || lap <= previous) continue;

      const surface = toInt(trackSurface?.[carIdx] ?? TrackLocation.OnTrack);
      let crossingFlags = 0;
      if (
        onPitRoad?.[carIdx] === true ||
        surface === TrackLocation.InPitStall
      ) {
        crossingFlags |= LAP_CROSSING_IN_PIT;
      }
      if (surface === TrackLocation.OffTrack) {
        crossingFlags |= LAP_CROSSING_OFF_TRACK;
      }
      // Compare current laps, not the completed one: against `previous` the
      // leader's own crossing would read as a lap down. Measured against the
      // whole field, not the car's class, because the processor has no class
      // data - consumers that need a class-accurate gap match on equal lap
      // count instead of trusting this flag.
      if (leaderLap - lap >= 1) {
        crossingFlags |= LAP_CROSSING_LAPPED;
      }

      this.append(carIdx, {
        // The lap just completed is the one the car was on before the tick.
        lap: previous,
        sessionTime,
        classPosition: clampByte(toInt(classPositions?.[carIdx] ?? 0)),
        flags: crossingFlags,
      });
      changed = true;
    }

    if (changed) this.publish();
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      // Replay scrubbing rewinds lap counters, which would fabricate
      // crossings. Aggregate live sessions only (R3.6).
      this.enabled = !event.replay;
      if (event.replay) this.reset(null);
      return;
    }
    this.reset(null);
  }

  snapshot(): LapHistorySnapshot {
    return this.latest;
  }

  private append(
    carIdx: number,
    crossing: {
      lap: number;
      sessionTime: number;
      classPosition: number;
      flags: number;
    }
  ): void {
    const base = carIdx * this.capacity;
    const used = this.count[carIdx];
    const offset =
      used < this.capacity
        ? (this.start[carIdx] + used) % this.capacity
        : this.start[carIdx];
    const slot = base + offset;

    this.lap[slot] = crossing.lap;
    this.sessionTime[slot] = crossing.sessionTime;
    this.classPosition[slot] = crossing.classPosition;
    this.flags[slot] = crossing.flags;

    if (used < this.capacity) {
      this.count[carIdx] = used + 1;
    } else {
      // Ring is full - the write consumed the oldest slot, so advance start.
      this.start[carIdx] = (this.start[carIdx] + 1) % this.capacity;
    }
  }

  private publish(): void {
    this.version += 1;
    this.latest.version = this.version;
    this.latest.sessionNum = this.sessionNum;
  }

  private reset(sessionNum: number | null): void {
    this.sessionNum = sessionNum;
    this.count.fill(0);
    this.start.fill(0);
    this.previousLap.fill(-1);
    this.publish();
  }
}

const zeroes = (length: number): number[] => new Array<number>(length).fill(0);

const toInt = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const clampByte = (value: number): number =>
  value < 0 ? 0 : value > 255 ? 255 : value;

const numberValue = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
