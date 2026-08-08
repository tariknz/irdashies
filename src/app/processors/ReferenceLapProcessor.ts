import type {
  Driver,
  ReferenceLap,
  ReferenceLapsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const TARGET_SPACING_METERS = 10;
const VALID_PACE_RATIO = 0.85;

export interface ReferenceLapPersistence {
  load(seriesId: number, trackId: number, classId: number): ReferenceLap | null;
  save(
    seriesId: number,
    trackId: number,
    classId: number,
    lap: ReferenceLap
  ): void;
}

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

const bucketIndex = (trackPct: number, pointsCount: number): number =>
  Math.min(Math.max(Math.floor(trackPct * pointsCount), 0), pointsCount - 1);

const createLap = (
  pointsCount: number,
  interval: number,
  sessionTime: number,
  trackPct: number,
  clean: boolean
): ReferenceLap => ({
  startTime: trackPct <= interval ? sessionTime : Number.MAX_SAFE_INTEGER,
  finishTime: -1,
  times: new Float32Array(pointsCount),
  pointPos: new Float32Array(pointsCount).fill(-1),
  tangents: new Float32Array(pointsCount),
  interval,
  pointsCount,
  lastTrackedPct: trackPct,
  isCleanLap: trackPct <= interval && clean,
});

const precomputeTangents = (lap: ReferenceLap): void => {
  const { pointPos: x, times: y, tangents } = lap;
  const count = x.length;
  if (count < 2) return;
  const deltas = new Float32Array(count - 1);
  for (let index = 0; index < count - 1; index += 1) {
    deltas[index] = (y[index + 1] - y[index]) / (x[index + 1] - x[index]);
  }
  const lapTime = lap.finishTime - lap.startTime;
  const before =
    (y[0] - (y[count - 1] - lapTime)) / (x[0] - (x[count - 1] - 1));
  const after = (y[0] + lapTime - y[count - 1]) / (x[0] + 1 - x[count - 1]);
  const assign = (
    index: number,
    left: number,
    right: number,
    leftWidth: number,
    rightWidth: number
  ) => {
    if (left * right <= 0) {
      tangents[index] = 0;
      return;
    }
    const firstWeight = 2 * rightWidth + leftWidth;
    const secondWeight = rightWidth + 2 * leftWidth;
    tangents[index] =
      (firstWeight + secondWeight) /
      (firstWeight / left + secondWeight / right);
  };
  assign(0, before, deltas[0], x[0] - (x[count - 1] - 1), x[1] - x[0]);
  for (let index = 1; index < count - 1; index += 1) {
    assign(
      index,
      deltas[index - 1],
      deltas[index],
      x[index] - x[index - 1],
      x[index + 1] - x[index]
    );
  }
  assign(
    count - 1,
    deltas[count - 2],
    after,
    x[count - 1] - x[count - 2],
    x[0] + 1 - x[count - 1]
  );
};

export class ReferenceLapProcessor implements TelemetryProcessor<ReferenceLapsSnapshot> {
  readonly channel = 'reference-laps.snapshot';
  readonly tickRateHz = 'event';

  private activeLaps = new Map<number, ReferenceLap>();
  private bestLaps = new Map<number, ReferenceLap>();
  private persistedLaps = new Map<number, ReferenceLap>();
  private loadedClassIds = new Set<number>();
  private drivers: (Driver | undefined)[] = [];
  private seriesId = -1;
  private trackId = -1;
  private sessionIdentity = '';
  private pointsCount = 0;
  private interval = 0;
  private sessionNum: number | null = null;
  private aggregationEnabled = true;
  private persistenceEnabled = true;
  private latest: ReferenceLapsSnapshot = this.emptySnapshot();

  constructor(private readonly persistence: ReferenceLapPersistence) {}

  init(session: Session): void {
    const seriesId = session.WeekendInfo?.SeriesID ?? -1;
    const trackId = session.WeekendInfo?.TrackID ?? -1;
    const trackLength = trackLengthFrom(session);
    const sessionIdentity = `${seriesId}:${trackId}:${session.WeekendInfo?.SubSessionID ?? -1}:${trackLength}`;
    const drivers = (session.DriverInfo?.Drivers ?? []) as (
      Driver | undefined
    )[];
    this.drivers = drivers;
    if (trackId <= 0 || trackLength <= 0) return;
    if (sessionIdentity === this.sessionIdentity) {
      if (this.loadPersistedForDrivers(session.DriverInfo?.PaceCarIdx ?? -1)) {
        this.publish();
      }
      return;
    }
    this.seriesId = seriesId;
    this.trackId = trackId;
    this.sessionIdentity = sessionIdentity;
    this.pointsCount = Math.ceil(trackLength / TARGET_SPACING_METERS);
    this.interval = Number.parseFloat((1 / this.pointsCount).toFixed(6));
    this.activeLaps.clear();
    this.bestLaps.clear();
    this.persistedLaps.clear();
    this.loadedClassIds.clear();
    this.loadPersistedForDrivers(session.DriverInfo?.PaceCarIdx ?? -1);
    this.publish();
  }

  onFrame(frame: Telemetry): void {
    if (!this.aggregationEnabled || this.pointsCount === 0) return;
    const sessionNum = numericValue(frame, 'SessionNum');
    if (
      this.sessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== this.sessionNum
    ) {
      this.resetSession(sessionNum);
    }
    this.sessionNum = sessionNum;
    const distances = frame.CarIdxLapDistPct?.value;
    const pitRoad = frame.CarIdxOnPitRoad?.value;
    const sessionTime = numericValue(frame, 'SessionTime');
    if (
      !Array.isArray(distances) ||
      distances.length === 0 ||
      sessionTime === null
    ) {
      return;
    }

    for (const driver of this.drivers) {
      if (!driver) continue;
      const carIdx = driver.CarIdx;
      const trackPct = distances[carIdx];
      if (
        typeof trackPct !== 'number' ||
        !Number.isFinite(trackPct) ||
        trackPct < 0
      ) {
        continue;
      }
      const clean = !pitRoad?.[carIdx];
      const active = this.activeLaps.get(carIdx);
      if (!active) {
        this.activeLaps.set(
          carIdx,
          createLap(
            this.pointsCount,
            this.interval,
            sessionTime,
            trackPct,
            clean
          )
        );
        continue;
      }
      if (active.lastTrackedPct > 0.95 && trackPct < 0.05) {
        active.finishTime = sessionTime;
        this.promote(driver, active);
        this.activeLaps.set(
          carIdx,
          createLap(
            this.pointsCount,
            this.interval,
            sessionTime,
            trackPct,
            clean
          )
        );
        continue;
      }
      if (!clean) active.isCleanLap = false;
      const key = bucketIndex(trackPct, this.pointsCount);
      if (active.pointPos[key] !== -1) continue;
      if (key > 0 && active.pointPos[key - 1] === -1) active.isCleanLap = false;
      if (active.isCleanLap) {
        active.times[key] = sessionTime - active.startTime;
        active.pointPos[key] = trackPct;
      }
      active.lastTrackedPct = trackPct;
    }
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.resetSession(null);
      this.aggregationEnabled = !event.replay;
      this.persistenceEnabled = !event.replay;
      return;
    }
    this.resetSession(null);
    if (event.type === 'disconnect') this.aggregationEnabled = false;
  }

  snapshot(): ReferenceLapsSnapshot {
    return this.latest;
  }

  /** Discards an incomplete lap when processing demand is paused. */
  pause(): void {
    this.activeLaps.clear();
  }

  private promote(driver: Driver, lap: ReferenceLap): void {
    const lapTime = lap.finishTime - lap.startTime;
    if (
      !lap.isCleanLap ||
      lap.pointPos.includes(-1) ||
      lapTime <= 0 ||
      driver.CarClassID <= 0
    ) {
      return;
    }
    const persisted = this.persistedLaps.get(driver.CarClassID);
    const persistedTime = persisted
      ? persisted.finishTime - persisted.startTime
      : null;
    if (persistedTime && persistedTime / lapTime < VALID_PACE_RATIO) return;
    const best = this.bestLaps.get(driver.CarIdx);
    const bestTime = best ? best.finishTime - best.startTime : null;
    if (bestTime && lapTime >= bestTime) return;
    precomputeTangents(lap);
    this.bestLaps.set(driver.CarIdx, lap);
    if (!persistedTime || lapTime < persistedTime) {
      this.persistedLaps.set(driver.CarClassID, lap);
      if (this.persistenceEnabled && this.seriesId > 0) {
        this.persistence.save(
          this.seriesId,
          this.trackId,
          driver.CarClassID,
          lap
        );
      }
    }
    this.publish();
  }

  private loadPersistedForDrivers(paceCarIdx: number): boolean {
    const paceClassId = this.drivers[paceCarIdx]?.CarClassID ?? -1;
    let changed = false;
    for (const driver of this.drivers) {
      const classId = driver?.CarClassID;
      if (
        !classId ||
        classId <= 0 ||
        classId === paceClassId ||
        this.loadedClassIds.has(classId)
      ) {
        continue;
      }
      this.loadedClassIds.add(classId);
      const lap =
        this.seriesId > 0
          ? this.persistence.load(this.seriesId, this.trackId, classId)
          : null;
      if (lap) {
        this.persistedLaps.set(classId, lap);
        changed = true;
      }
    }
    return changed;
  }

  private resetSession(sessionNum: number | null): void {
    this.activeLaps.clear();
    this.bestLaps.clear();
    this.sessionNum = sessionNum;
    this.publish();
  }

  private publish(): void {
    this.latest = {
      bestLaps: [...this.bestLaps],
      persistedLaps: [...this.persistedLaps],
      sessionNum: this.sessionNum,
      version: this.latest.version + 1,
    };
  }

  private emptySnapshot(): ReferenceLapsSnapshot {
    return { bestLaps: [], persistedLaps: [], sessionNum: null, version: 0 };
  }
}
