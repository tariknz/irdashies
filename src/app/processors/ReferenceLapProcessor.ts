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
/** Conversion from the m/s of the raw `Speed` channel to the km/h we store. */
const MS_TO_KPH = 3.6;

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
  /** Only needed to record speeds — iRacing has no CarIdxSpeed. */
  private playerCarIdx = -1;
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
    this.playerCarIdx = session.DriverInfo?.DriverCarIdx ?? -1;
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
    // Raw m/s, player-only — converted to km/h when written below.
    const playerSpeedMs = numericValue(frame, 'Speed');
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

        // Speed is player-only (no CarIdxSpeed in iRacing). Written from the
        // same tick as times/pointPos above so the speed/position pairing
        // carries no skew. Allocated lazily so 63 opponents don't each carry a
        // dead buffer, and so a lap already in progress when the player's car
        // index becomes known still starts recording.
        if (carIdx === this.playerCarIdx && playerSpeedMs !== null) {
          active.speedsKph ??= new Float32Array(this.pointsCount);
          active.speedsKph[key] = playerSpeedMs * MS_TO_KPH;
        }
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
    // Deliberately not gated on CarClassID: bestLaps is keyed by CarIdx and
    // nothing on this path needs a class. iRacing reports CarClassID 0 in test
    // sessions, which is a real session rather than missing data — gating
    // promotion on it silently disabled every bestLaps consumer there (Delta
    // Speed, SectorDelta's ghost). The class is still required for
    // *persistence*, which is keyed by it.
    if (!lap.isCleanLap || lap.pointPos.includes(-1) || lapTime <= 0) return;
    const classId = driver.CarClassID;
    const persisted = classId > 0 ? this.persistedLaps.get(classId) : undefined;
    const persistedTime = persisted
      ? persisted.finishTime - persisted.startTime
      : null;
    if (persistedTime && persistedTime / lapTime < VALID_PACE_RATIO) return;
    const best = this.bestLaps.get(driver.CarIdx);
    const bestTime = best ? best.finishTime - best.startTime : null;
    if (bestTime && lapTime >= bestTime) return;
    precomputeTangents(lap);
    this.bestLaps.set(driver.CarIdx, lap);
    // classId > 0 guards persistence only. The disk key is
    // seriesId_trackId_classId, so class-0 laps from different cars in offline
    // test sessions would all collide on one key and overwrite each other.
    if (classId > 0 && (!persistedTime || lapTime < persistedTime)) {
      this.persistedLaps.set(classId, lap);
      if (this.persistenceEnabled && this.seriesId > 0) {
        // speedsKph is dropped on the way to disk. Only the in-session best
        // feeds the speed delta, and a lap loaded from disk is only ever
        // consulted as the class ghost, which is deliberately rejected as a
        // speed reference. Persisting it would grow the pretty-printed JSON by
        // a third — ~58KB per lap at Nordschleife bucket counts — for an array
        // nothing reads back. Copied rather than deleted in place: this same
        // object is the live entry in bestLaps.
        const persistable: ReferenceLap = { ...lap };
        delete persistable.speedsKph;
        this.persistence.save(
          this.seriesId,
          this.trackId,
          classId,
          persistable
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
