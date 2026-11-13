import type {
  PitStopRecord,
  PitStopsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { PIT_STOP_CAPACITY, TrackLocation } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const MAX_CARS = 64;
/** Surface value for a car not seen yet this session. */
const UNSEEN = -2;
/** The roster lags a driver swap by a few seconds, so the out driver settles. */
export const DRIVER_SETTLE_SECONDS = 90;
/** A car gone from the world this long has left its stop. */
const ABANDON_SECONDS = 120;
/** Less time on pit road than this, without stopping, is a line brush. */
const MIN_PIT_ROAD_SECONDS = 5;

interface RosterEntry {
  userId: number | null;
  name: string;
}

/**
 * Records every pit stop by every car: pit road entry and exit, time in the
 * stall, the driver either side of it, class position, tyre compound and fast
 * repairs. A tow to the stall from the track counts as a stop.
 *
 * Retention: PIT_STOP_CAPACITY stops per session, oldest dropped first.
 * Per-car state is held in arrays sized once; a frame allocates nothing
 * unless a stop starts.
 */
export class PitStopProcessor implements TelemetryProcessor<
  PitStopsSnapshot,
  'pit-stops.snapshot'
> {
  readonly channel = 'pit-stops.snapshot';
  readonly tickRateHz = 'event' as const;

  private readonly surface = new Array<number>(MAX_CARS).fill(UNSEEN);
  private readonly onPitRoad = new Array<boolean>(MAX_CARS).fill(false);
  /** Seen on track this session, so a later appearance in the stall is a tow. */
  private readonly raced = new Array<boolean>(MAX_CARS).fill(false);
  private readonly open = new Array<PitStopRecord | null>(MAX_CARS).fill(null);
  private readonly repairsAtEntry = new Array<number>(MAX_CARS).fill(0);
  private readonly goneSince = new Array<number>(MAX_CARS).fill(NaN);
  private readonly roster = new Map<number, RosterEntry>();
  private readonly ignored = new Set<number>();

  private sessionNum: number | null = null;
  private subSessionId: number | null = null;
  private sessionTime = 0;
  private nextId = 1;
  private readonly latest: PitStopsSnapshot = {
    subSessionId: null,
    sessionNum: null,
    sessionTime: 0,
    stops: [],
    version: 0,
  };

  init(session: Session): void {
    const rawId = session?.WeekendInfo?.SubSessionID;
    const subSessionId = typeof rawId === 'number' && rawId > 0 ? rawId : null;
    // A new event can reuse the session number, so the next frame would not
    // reset; its stops must not carry over.
    if (subSessionId !== this.subSessionId && this.sessionNum !== null) {
      this.reset(null);
    }
    this.subSessionId = subSessionId;
    this.latest.subSessionId = subSessionId;

    this.roster.clear();
    this.ignored.clear();
    for (const driver of session?.DriverInfo?.Drivers ?? []) {
      if (typeof driver?.CarIdx !== 'number') continue;
      if (driver.CarIsPaceCar === 1 || driver.IsSpectator === 1) {
        this.ignored.add(driver.CarIdx);
        continue;
      }
      this.roster.set(driver.CarIdx, {
        userId:
          typeof driver.UserID === 'number' && driver.UserID > 0
            ? driver.UserID
            : null,
        name: driver.UserName ?? '',
      });
    }
    if (this.settleDrivers()) this.bump();
  }

  onFrame(frame: Telemetry): void {
    const surfaces = frame.CarIdxTrackSurface?.value;
    if (!Array.isArray(surfaces)) return;

    const sessionNum = numberValue(frame, 'SessionNum');
    if (sessionNum !== null && sessionNum !== this.sessionNum) {
      this.reset(sessionNum);
    }
    this.sessionTime = numberValue(frame, 'SessionTime') ?? this.sessionTime;
    const now = this.sessionTime;

    const pitRoad = frame.CarIdxOnPitRoad?.value;
    const laps = frame.CarIdxLap?.value;
    const positions = frame.CarIdxClassPosition?.value;
    const compounds = frame.CarIdxTireCompound?.value;
    const repairs = frame.CarIdxFastRepairsUsed?.value;

    let changed = false;
    const cars = Math.min(surfaces.length, MAX_CARS);
    for (let carIdx = 0; carIdx < cars; carIdx += 1) {
      if (this.ignored.has(carIdx)) continue;
      const surface = toInt(surfaces[carIdx], TrackLocation.NotInWorld);
      const onPit = pitRoad?.[carIdx] === true;
      const previousSurface = this.surface[carIdx];
      const wasOnPit = this.onPitRoad[carIdx];
      this.surface[carIdx] = surface;
      this.onPitRoad[carIdx] = onPit;

      // Mid-stop on the first frame seen: there is no entry to time from.
      if (previousSurface === UNSEEN) {
        if (surface === TrackLocation.OnTrack) this.raced[carIdx] = true;
        continue;
      }

      let stop = this.open[carIdx];
      if (!stop) {
        const pitted =
          onPit &&
          !wasOnPit &&
          surface !== TrackLocation.NotInWorld &&
          previousSurface !== TrackLocation.NotInWorld;
        const towed =
          surface === TrackLocation.InPitStall &&
          previousSurface === TrackLocation.NotInWorld &&
          this.raced[carIdx];
        if (pitted || towed) {
          stop = this.start(carIdx, pitted ? 'pit' : 'tow', {
            lap: toInt(laps?.[carIdx], 0),
            classPosition: toInt(positions?.[carIdx], 0),
            compound: toInt(compounds?.[carIdx], -1),
            repairs: toInt(repairs?.[carIdx], 0),
          });
          changed = true;
        }
      }
      if (surface === TrackLocation.OnTrack) this.raced[carIdx] = true;
      if (!stop) continue;

      if (surface === TrackLocation.NotInWorld) {
        if (Number.isNaN(this.goneSince[carIdx])) this.goneSince[carIdx] = now;
        if (now - this.goneSince[carIdx] >= ABANDON_SECONDS) {
          this.finish(carIdx, stop, this.goneSince[carIdx], 0, -1, 0);
          changed = true;
        }
        continue;
      }
      this.goneSince[carIdx] = NaN;

      if (surface === TrackLocation.InPitStall) {
        if (stop.stallEnteredAt === null) {
          stop.stallEnteredAt = now;
          stop.stallTime ??= now;
          changed = true;
        }
      } else if (stop.stallEnteredAt !== null) {
        stop.stallSeconds += now - stop.stallEnteredAt;
        stop.stallEnteredAt = null;
        changed = true;
      }

      if (!onPit && surface !== TrackLocation.InPitStall) {
        this.finish(
          carIdx,
          stop,
          now,
          toInt(positions?.[carIdx], 0),
          toInt(compounds?.[carIdx], -1),
          toInt(repairs?.[carIdx], 0) - this.repairsAtEntry[carIdx]
        );
        changed = true;
      }
    }

    if (changed) this.bump();
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'sessionNumChange') return;
    // Rebaseline: anything that happened while frames were not arriving was
    // not seen. Stops already recorded stay, so a finished race can be read.
    this.surface.fill(UNSEEN);
    this.onPitRoad.fill(false);
    this.open.fill(null);
    this.goneSince.fill(NaN);
    for (const stop of this.latest.stops) {
      if (stop.exitTime === null) this.close(stop, this.sessionTime);
    }
    this.bump();
  }

  snapshot(): PitStopsSnapshot {
    this.latest.sessionTime = this.sessionTime;
    return this.latest;
  }

  /**
   * Puts back the finished stops saved before a restart, ahead of anything
   * recorded since. A live stop that began before the last saved one is a
   * duplicate of it and is dropped.
   */
  restore(stops: readonly PitStopRecord[]): boolean {
    const restored = stops
      .filter((stop) => stop.exitTime !== null)
      .map((stop) => ({ ...stop }));
    if (restored.length === 0) return false;
    const lastRestored = restored[restored.length - 1].entryTime;
    const live = this.latest.stops.filter(
      (stop) => stop.entryTime > lastRestored
    );
    let id = restored.reduce((max, stop) => Math.max(max, stop.id), 0);
    for (const stop of live) stop.id = ++id;
    this.nextId = id + 1;
    this.latest.stops = [...restored, ...live].slice(-PIT_STOP_CAPACITY);
    for (let carIdx = 0; carIdx < MAX_CARS; carIdx += 1) {
      const open = this.open[carIdx];
      if (open && !live.includes(open)) this.open[carIdx] = null;
    }
    this.bump();
    return true;
  }

  private start(
    carIdx: number,
    kind: PitStopRecord['kind'],
    at: {
      lap: number;
      classPosition: number;
      compound: number;
      repairs: number;
    }
  ): PitStopRecord {
    const driver = this.roster.get(carIdx);
    const stop: PitStopRecord = {
      id: this.nextId++,
      carIdx,
      kind,
      lap: at.lap,
      entryTime: this.sessionTime,
      exitTime: null,
      stallTime: null,
      stallSeconds: 0,
      stallEnteredAt: null,
      driverIdIn: driver?.userId ?? null,
      driverNameIn: driver?.name ?? '',
      driverIdOut: driver?.userId ?? null,
      driverNameOut: driver?.name ?? '',
      classPositionIn: at.classPosition,
      classPositionOut: 0,
      compoundIn: at.compound,
      compoundOut: at.compound,
      fastRepairs: 0,
    };
    this.repairsAtEntry[carIdx] = at.repairs;
    this.open[carIdx] = stop;
    this.latest.stops.push(stop);
    if (this.latest.stops.length > PIT_STOP_CAPACITY) this.latest.stops.shift();
    return stop;
  }

  private finish(
    carIdx: number,
    stop: PitStopRecord,
    at: number,
    classPosition: number,
    compound: number,
    fastRepairs: number
  ): void {
    this.open[carIdx] = null;
    this.goneSince[carIdx] = NaN;
    if (
      stop.kind === 'pit' &&
      stop.stallTime === null &&
      at - stop.entryTime < MIN_PIT_ROAD_SECONDS
    ) {
      const index = this.latest.stops.indexOf(stop);
      if (index >= 0) this.latest.stops.splice(index, 1);
      return;
    }
    this.close(stop, at);
    stop.classPositionOut = classPosition;
    if (compound >= 0) stop.compoundOut = compound;
    stop.fastRepairs = Math.max(0, fastRepairs);
    const driver = this.roster.get(carIdx);
    if (driver) {
      stop.driverIdOut = driver.userId;
      stop.driverNameOut = driver.name;
    }
  }

  private close(stop: PitStopRecord, at: number): void {
    if (stop.stallEnteredAt !== null) {
      stop.stallSeconds += Math.max(0, at - stop.stallEnteredAt);
      stop.stallEnteredAt = null;
    }
    stop.exitTime = at;
  }

  /** Follows a driver swap the roster reports after the stop has begun. */
  private settleDrivers(): boolean {
    let changed = false;
    for (const stop of this.latest.stops) {
      const settling =
        stop.exitTime === null ||
        this.sessionTime - stop.exitTime <= DRIVER_SETTLE_SECONDS;
      if (!settling) continue;
      const driver = this.roster.get(stop.carIdx);
      if (!driver || driver.userId === stop.driverIdOut) continue;
      stop.driverIdOut = driver.userId;
      stop.driverNameOut = driver.name;
      changed = true;
    }
    return changed;
  }

  private bump(): void {
    this.latest.version += 1;
    this.latest.sessionNum = this.sessionNum;
  }

  private reset(sessionNum: number | null): void {
    this.sessionNum = sessionNum;
    this.surface.fill(UNSEEN);
    this.onPitRoad.fill(false);
    this.raced.fill(false);
    this.open.fill(null);
    this.goneSince.fill(NaN);
    this.latest.stops = [];
    this.nextId = 1;
    this.bump();
  }
}

const toInt = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
};

const numberValue = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
