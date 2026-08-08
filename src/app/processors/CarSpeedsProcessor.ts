import type {
  CarSpeedsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const SPEED_AVG_WINDOW = 5;
const SPEED_UPDATE_INTERVAL = 0.1;
const TIME_EPSILON = 1e-6;
const METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR = 3.6;

const numericValues = (
  frame: Telemetry,
  key: keyof Telemetry
): readonly number[] => {
  const values = frame[key]?.value;
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0
  );
};

const numericValue = (
  frame: Telemetry,
  key: keyof Telemetry
): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const trackLengthFrom = (session: Session): number => {
  const [value, unit] = session.WeekendInfo?.TrackLength?.split(' ') ?? [];
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return unit === 'km' ? parsed * 1000 : parsed;
};

export class CarSpeedsProcessor implements TelemetryProcessor<CarSpeedsSnapshot> {
  readonly channel = 'car-speeds.snapshot';
  readonly tickRateHz = 10;

  private trackLength = 0;
  private lastLapDistPct: readonly number[] | null = null;
  private lastSessionTime: number | null = null;
  private lastSpeedUpdate: number | null = null;
  private speedHistory: number[][] = [];
  private latest: CarSpeedsSnapshot = this.emptySnapshot();
  private aggregationEnabled = true;

  init(session: Session): void {
    this.trackLength = trackLengthFrom(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.aggregationEnabled) return;
    const sessionTime = numericValue(frame, 'SessionTime');
    const sessionNum = numericValue(frame, 'SessionNum');
    if (sessionTime === null) return;

    if (
      this.latest.sessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.reset(sessionNum);
    }

    const timeWentBackwards =
      this.lastSpeedUpdate !== null && sessionTime < this.lastSpeedUpdate;
    const enoughTimePassed =
      this.lastSpeedUpdate === null ||
      sessionTime - this.lastSpeedUpdate >=
        SPEED_UPDATE_INTERVAL - TIME_EPSILON;
    if (!timeWentBackwards && !enoughTimePassed) return;

    const lapDistPct = numericValues(frame, 'CarIdxLapDistPct');
    if (lapDistPct.length === 0) return;
    if (!this.trackLength) {
      this.publish(Array(lapDistPct.length).fill(0), sessionNum);
      return;
    }

    const sameFieldSize = this.lastLapDistPct?.length === lapDistPct.length;
    if (!sameFieldSize) {
      this.speedHistory = lapDistPct.map(
        (_, carIdx) => this.speedHistory[carIdx] ?? []
      );
    } else if (
      this.lastSessionTime !== null &&
      sessionTime > this.lastSessionTime
    ) {
      const deltaTime = sessionTime - this.lastSessionTime;
      lapDistPct.forEach((pct, carIdx) => {
        const previous = this.lastLapDistPct?.[carIdx] ?? pct;
        let distancePercent = pct - previous;
        if (distancePercent < 0 && previous > 0.9 && pct < 0.1) {
          distancePercent += 1;
        }
        const speed =
          ((this.trackLength * distancePercent) / deltaTime) *
          METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR;
        const history = this.speedHistory[carIdx] ?? [];
        history.push(speed);
        if (history.length > SPEED_AVG_WINDOW) history.shift();
        this.speedHistory[carIdx] = history;
      });
    }

    if (timeWentBackwards) {
      this.speedHistory = this.speedHistory.map((history) => [
        history.at(-1) ?? 0,
      ]);
    }

    const speeds = timeWentBackwards
      ? Array(lapDistPct.length).fill(0)
      : this.speedHistory.map((history) =>
          history.length
            ? Math.round(
                history.reduce((sum, speed) => sum + speed, 0) / history.length
              )
            : 0
        );
    this.lastLapDistPct = [...lapDistPct];
    this.lastSessionTime = sessionTime;
    this.lastSpeedUpdate = sessionTime;
    this.publish(speeds, sessionNum);
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

  snapshot(): CarSpeedsSnapshot {
    return this.latest;
  }

  private publish(carSpeeds: readonly number[], sessionNum: number | null) {
    this.latest = {
      carSpeeds,
      sessionNum,
      version: this.latest.version + 1,
    };
  }

  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    this.lastLapDistPct = null;
    this.lastSessionTime = null;
    this.lastSpeedUpdate = null;
    this.speedHistory = [];
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
  }

  private emptySnapshot(): CarSpeedsSnapshot {
    return { carSpeeds: [], sessionNum: null, version: 0 };
  }
}
