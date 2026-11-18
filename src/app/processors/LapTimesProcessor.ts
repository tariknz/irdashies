import type {
  LapTimesSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { TrackLocation } from '../irsdk/types/enums';
import type { TelemetryProcessor } from './TelemetryProcessor';

const LAP_TIME_AVG_WINDOW = 10;
// Bounded independently for all laps and eligible laps, including endurance races.
const HISTORY_CAPACITY = 100;
const OUTLIER_THRESHOLD = 1;

const median = (numbers: readonly number[]): number => {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return numbers[0];
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const filterOutliers = (lapTimes: readonly number[]): readonly number[] => {
  if (lapTimes.length < 3) return lapTimes;
  const mean = lapTimes.reduce((sum, time) => sum + time, 0) / lapTimes.length;
  const variance =
    lapTimes.reduce((sum, time) => sum + (time - mean) ** 2, 0) /
    lapTimes.length;
  const threshold = Math.sqrt(variance) * OUTLIER_THRESHOLD;
  return lapTimes.filter((time) => Math.abs(time - mean) <= threshold);
};

const paceFor = (history: readonly (readonly number[])[]): number[] =>
  history.map((samples) =>
    samples.length
      ? median(filterOutliers(samples.slice(-LAP_TIME_AVG_WINDOW)))
      : 0
  );

const numericValue = (
  frame: Telemetry,
  key: keyof Telemetry
): number | null => {
  const candidate = frame[key]?.value?.[0];
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : null;
};

export class LapTimesProcessor implements TelemetryProcessor<LapTimesSnapshot> {
  readonly channel = 'lap-times.snapshot';
  readonly tickRateHz = 'event';

  private readonly cars: CarLapState[] = [];
  private history: number[][] = [];
  private cleanHistory: number[][] = [];
  private latest: LapTimesSnapshot = this.emptySnapshot();
  private aggregationEnabled = true;
  private lastSessionTime: number | null = null;

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    if (!this.aggregationEnabled) return;
    const lapTimes = frame.CarIdxLastLapTime?.value;
    if (!Array.isArray(lapTimes) || lapTimes.length === 0) return;
    const sessionNum = numericValue(frame, 'SessionNum');
    const sessionTime = numericValue(frame, 'SessionTime');

    if (
      this.latest.sessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.reset(sessionNum);
    }
    if (
      sessionTime !== null &&
      this.lastSessionTime !== null &&
      sessionTime < this.lastSessionTime
    ) {
      this.reset(sessionNum);
    }
    this.lastSessionTime = sessionTime;
    const completed = frame.CarIdxLapCompleted?.value;
    const pitRoad = frame.CarIdxOnPitRoad?.value;
    const surface = frame.CarIdxTrackSurface?.value;
    let changed = this.history.length !== lapTimes.length;
    for (let carIdx = 0; carIdx < lapTimes.length; carIdx++) {
      const lapTime = finiteNumber(lapTimes[carIdx]) ?? -1;
      const lap = finiteNumber(completed?.[carIdx]);
      const inPit =
        Boolean(pitRoad?.[carIdx]) ||
        surface?.[carIdx] === TrackLocation.InPitStall;
      const unavailable = surface?.[carIdx] === TrackLocation.NotInWorld;
      let car = this.cars[carIdx];
      if (!car) {
        car = {
          lastTime: lapTime,
          completed: lap,
          pitLap: true,
          pending: false,
          pendingClean: false,
          lastRecordedLap: -1,
        };
        this.cars[carIdx] = car;
        this.history[carIdx] = [];
        this.cleanHistory[carIdx] = [];
        continue;
      }

      if (lap !== null && car.completed !== null) {
        if (lap < car.completed || lap < 0) {
          // Tow, garage reset, or disappearance: do not reuse an old time.
          car.pending = false;
          car.pitLap = true;
          if (lap < 0 || car.completed - lap > 1) car.lastRecordedLap = -1;
        } else if (lap > car.completed) {
          // A time unchanged for an entire completed lap can be identical.
          // Do not guess after a timeout: recorded timing updates can arrive
          // over five seconds late, with counter corrections in between.
          if (
            car.pending &&
            lap === car.completed + 1 &&
            lapTime === car.lastTime &&
            lapTime > 0
          ) {
            this.append(carIdx, lapTime, car.pendingClean);
            car.lastRecordedLap = car.completed;
            changed = true;
          }
          car.pending =
            lap === car.completed + 1 &&
            car.completed >= 0 &&
            lap > car.lastRecordedLap;
          car.pendingClean = !car.pitLap && !inPit && !unavailable;
          car.pitLap = inPit || unavailable;
        }
        if (car.pending && lapTime !== car.lastTime) {
          if (lapTime > 0) {
            this.append(carIdx, lapTime, car.pendingClean);
            car.lastRecordedLap = lap;
            changed = true;
          }
          car.pending = false;
        }
      } else if (lap === null && lapTime > 0 && lapTime !== car.lastTime) {
        // Older recordings/sources without counters retain the legacy history.
        // Pit eligibility is unknown without a fully observed lap boundary.
        this.append(carIdx, lapTime, false);
        changed = true;
      }
      car.completed = lap;
      car.lastTime = lapTime;
      car.pitLap ||= inPit || unavailable;
    }
    if (!changed) return;
    this.history.length = lapTimes.length;
    this.cleanHistory.length = lapTimes.length;
    this.cars.length = lapTimes.length;
    this.latest = {
      lapTimes: paceFor(this.history),
      lapTimeHistory: [...this.history],
      cleanLapTimeHistory: [...this.cleanHistory],
      sessionNum,
      version: this.latest.version + 1,
    };
  }

  private append(carIdx: number, lapTime: number, clean: boolean): void {
    this.history[carIdx] = [...this.history[carIdx], lapTime].slice(
      -HISTORY_CAPACITY
    );
    if (clean) {
      this.cleanHistory[carIdx] = [...this.cleanHistory[carIdx], lapTime].slice(
        -HISTORY_CAPACITY
      );
    }
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.reset(null);
      this.aggregationEnabled = !event.replay;
      return;
    }
    this.reset(null);
    if (event.type === 'disconnect') this.aggregationEnabled = false;
  }

  snapshot(): LapTimesSnapshot {
    return this.latest;
  }

  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    this.cars.length = 0;
    this.lastSessionTime = null;
    this.history = [];
    this.cleanHistory = [];
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
  }

  private emptySnapshot(): LapTimesSnapshot {
    return {
      lapTimes: [],
      lapTimeHistory: [],
      cleanLapTimeHistory: [],
      sessionNum: null,
      version: 0,
    };
  }
}

interface CarLapState {
  lastTime: number;
  completed: number | null;
  pitLap: boolean;
  pending: boolean;
  pendingClean: boolean;
  lastRecordedLap: number;
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
