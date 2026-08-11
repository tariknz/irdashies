import type {
  LapTimesSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const LAP_TIME_AVG_WINDOW = 10;
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
    samples.length ? median(filterOutliers(samples)) : 0
  );

const numericValues = (
  frame: Telemetry,
  key: keyof Telemetry
): readonly number[] => {
  const values = frame[key]?.value;
  if (!Array.isArray(values)) return [];
  return values.map((candidate) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0
  );
};

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

  private lastLapTimes: readonly number[] | null = null;
  private history: number[][] = [];
  private latest: LapTimesSnapshot = this.emptySnapshot();
  private aggregationEnabled = true;

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    if (!this.aggregationEnabled) return;
    const lapTimes = numericValues(frame, 'CarIdxLastLapTime');
    const sessionNum = numericValue(frame, 'SessionNum');

    if (
      this.latest.sessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.reset(sessionNum);
      return;
    }

    if (lapTimes.length === 0) return;
    if (!this.lastLapTimes) {
      this.lastLapTimes = [...lapTimes];
      this.history = lapTimes.map(() => []);
      this.latest = {
        lapTimes: paceFor(this.history),
        lapTimeHistory: this.history,
        sessionNum,
        version: this.latest.version + 1,
      };
      return;
    }
    if (this.lastLapTimes.length !== lapTimes.length) {
      this.lastLapTimes = [...lapTimes];
      this.history = lapTimes.map((_, carIdx) => this.history[carIdx] ?? []);
      this.latest = {
        lapTimes: paceFor(this.history),
        lapTimeHistory: this.history,
        sessionNum,
        version: this.latest.version + 1,
      };
      return;
    }

    let changed = false;
    const history = [...this.history];
    lapTimes.forEach((lapTime, carIdx) => {
      if (lapTime <= 0 || lapTime === this.lastLapTimes?.[carIdx]) return;
      history[carIdx] = [...(history[carIdx] ?? []), lapTime].slice(
        -LAP_TIME_AVG_WINDOW
      );
      changed = true;
    });
    this.lastLapTimes = [...lapTimes];
    if (!changed) return;

    this.history = history;
    this.latest = {
      lapTimes: paceFor(history),
      lapTimeHistory: history,
      sessionNum,
      version: this.latest.version + 1,
    };
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
    this.lastLapTimes = null;
    this.history = [];
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
  }

  private emptySnapshot(): LapTimesSnapshot {
    return { lapTimes: [], lapTimeHistory: [], sessionNum: null, version: 0 };
  }
}
