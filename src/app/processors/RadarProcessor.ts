import type {
  RadarCar,
  RadarSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { CarLeftRight, TrackLocation } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';
import { RadarLaneTracker } from './radarLanes';
import {
  computeFormation,
  PaceMode,
  parseStartingGrid,
  type Formation,
  type GridOptions,
} from './radarFormation';

/**
 * Metres either side of the focus car that still reach the renderer. The
 * widget's own range setting is applied there; this only bounds the payload,
 * so it sits above the largest range the settings allow.
 */
export const RADAR_MAX_RANGE_M = 120;

/** Weight of the newest sample in the per-car speed average. */
const SPEED_SMOOTHING = 0.25;
/** A lap-distance jump faster than this is a tow or reset, not driving. */
const MAX_PLAUSIBLE_SPEED_MS = 150;
/** Frames further apart than this restart the speed average. */
const MAX_FRAME_GAP_S = 0.5;

const valuesOf = (frame: Telemetry, key: string): readonly unknown[] =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value ?? [];

const numberAt = (
  values: readonly unknown[],
  index: number,
  fallback = -1
): number => {
  const value = values[index];
  return typeof value === 'number' ? value : fallback;
};

const scalarNumber = (frame: Telemetry, key: string, fallback = -1): number =>
  numberAt(valuesOf(frame, key), 0, fallback);

/** Shortest signed lap fraction from `from` to `to`, in -0.5..0.5. */
const wrapDelta = (to: number, from: number): number => {
  let delta = to - from;
  if (delta > 0.5) delta -= 1;
  else if (delta < -0.5) delta += 1;
  return delta;
};

/** WeekendInfo.TrackLength is a string such as "5.51 km" or "3.42 mi". */
export const parseTrackLength = (raw: string | undefined): number => {
  const [value, unit] = raw?.trim().split(/\s+/) ?? [];
  const parsed = parseFloat(value ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  if (unit === 'km') return parsed * 1000;
  if (unit === 'mi') return parsed * 1609.344;
  return parsed;
};

/**
 * Publishes the rivals around the focus car in metres.
 *
 * iRacing gives every car's lap progress but no world position, so distance is
 * measured along the track. Per-car speed comes from progress deltas because
 * the SDK reports speed for the player only, and the renderer needs it to
 * extrapolate between 25 Hz snapshots.
 */
export class RadarProcessor implements TelemetryProcessor<RadarSnapshot> {
  readonly channel = 'radar.snapshot';
  readonly tickRateHz = 25;

  private trackLength = 0;
  private readonly excluded = new Set<number>();
  private previousPcts: number[] = [];
  private speeds: number[] = [];
  private previousTime = -1;
  private readonly lanes = new RadarLaneTracker();
  private laneFocus = -1;
  private grid: GridOptions = {
    standingStart: false,
    columns: 2,
    poleSide: 'left',
  };
  private paceCarIdx = -1;

  private latest: RadarSnapshot = emptySnapshot(0);

  init(session: Session): void {
    this.trackLength = parseTrackLength(session?.WeekendInfo?.TrackLength);
    const options = session?.WeekendInfo?.WeekendOptions;
    this.grid = {
      standingStart: options?.StandingStart === 1,
      ...parseStartingGrid(options?.StartingGrid),
    };
    this.lanes.setPoleSide(this.grid.poleSide);
    this.paceCarIdx = session?.DriverInfo?.PaceCarIdx ?? -1;
    this.excluded.clear();
    for (const driver of session?.DriverInfo?.Drivers ?? []) {
      if (driver.CarIsPaceCar === 1 || driver.IsSpectator === 1) {
        this.excluded.add(driver.CarIdx);
      }
    }
  }

  onFrame(frame: Telemetry): void {
    const pcts = valuesOf(frame, 'CarIdxLapDistPct');
    const time = scalarNumber(frame, 'SessionTime');
    this.updateSpeeds(pcts, time);

    const camCarIdx = scalarNumber(frame, 'CamCarIdx');
    const focus =
      camCarIdx >= 0 ? camCarIdx : scalarNumber(frame, 'PlayerCarIdx');
    const playerPct = numberAt(pcts, focus);
    const onPitRoad = valuesOf(frame, 'CarIdxOnPitRoad');
    const surfaces = valuesOf(frame, 'CarIdxTrackSurface');
    const isOnTrack = valuesOf(frame, 'IsOnTrack')[0] === true;

    const cars: RadarCar[] = [];
    let formation: Formation | null = null;
    let follow: RadarSnapshot['follow'] = null;
    if (focus >= 0 && playerPct >= 0 && this.trackLength > 0) {
      const playerSpeed = this.speeds[focus] ?? 0;
      const dists: number[] = [];
      for (let carIdx = 0; carIdx < pcts.length; carIdx += 1) {
        const pct = numberAt(pcts, carIdx);
        const surface = numberAt(surfaces, carIdx);
        dists[carIdx] =
          pct < 0 || surface === TrackLocation.NotInWorld
            ? NaN
            : wrapDelta(pct, playerPct) * this.trackLength;
      }
      formation = computeFormation({
        focus,
        dists,
        pcts: pcts as readonly number[],
        surfaces: surfaces as readonly number[],
        onPitRoad: onPitRoad as readonly boolean[],
        excluded: this.excluded,
        paceMode: scalarNumber(frame, 'PaceMode', PaceMode.NotPacing),
        paceLines: valuesOf(frame, 'CarIdxPaceLine') as readonly number[],
        paceRows: valuesOf(frame, 'CarIdxPaceRow') as readonly number[],
        sessionState: scalarNumber(frame, 'SessionState'),
        speeds: this.speeds,
        lapsCompleted: valuesOf(
          frame,
          'CarIdxLapCompleted'
        ) as readonly number[],
        paceCarIdx: this.paceCarIdx,
        grid: this.grid,
      });
      const followCarIdx = formation?.followCarIdx ?? null;
      if (followCarIdx !== null && Number.isFinite(dists[followCarIdx])) {
        follow = {
          carIdx: followCarIdx,
          dist: dists[followCarIdx],
          isPaceCar: followCarIdx === this.paceCarIdx,
        };
      }

      for (let carIdx = 0; carIdx < pcts.length; carIdx += 1) {
        if (carIdx === focus || this.excluded.has(carIdx)) continue;
        const dist = dists[carIdx];
        const surface = numberAt(surfaces, carIdx);
        if (!Number.isFinite(dist) || Math.abs(dist) > RADAR_MAX_RANGE_M) {
          continue;
        }
        cars.push({
          carIdx,
          dist,
          closingSpeed: (this.speeds[carIdx] ?? playerSpeed) - playerSpeed,
          lane: 0,
          laneSource: 'none',
          onPitRoad: onPitRoad[carIdx] === true,
          offTrack: surface === TrackLocation.OffTrack,
        });
      }
      cars.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
      this.assignLanes(frame, time, focus, isOnTrack, cars, formation);
    }

    const next: Omit<RadarSnapshot, 'version'> = {
      focusCarIdx: focus >= 0 ? focus : null,
      playerPct: playerPct >= 0 ? playerPct : 0,
      playerSpeed: focus >= 0 ? (this.speeds[focus] ?? 0) : 0,
      trackLength: this.trackLength,
      focusOnPitRoad: focus >= 0 && onPitRoad[focus] === true,
      isOnTrack,
      formation: formation?.kind ?? null,
      follow,
      cars,
    };
    if (sameSnapshot(this.latest, next)) return;
    this.latest = { ...next, version: this.latest.version + 1 };
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    this.previousPcts = [];
    this.speeds = [];
    this.previousTime = -1;
    this.lanes.reset();
    this.laneFocus = -1;
    this.latest = emptySnapshot(this.latest.version + 1);
  }

  /**
   * The spotter speaks for the player's car only, and only while it is
   * driving; when the camera is on someone else, lanes come from memory and
   * pairing alone. Cars across the pit wall are beside the track, not in a
   * lane of it, so they stay out of the estimate.
   */
  private assignLanes(
    frame: Telemetry,
    time: number,
    focus: number,
    isOnTrack: boolean,
    cars: RadarCar[],
    formation: Formation | null
  ): void {
    if (focus !== this.laneFocus) {
      this.lanes.reset();
      this.laneFocus = focus;
    }
    const focusOnPitRoad = valuesOf(frame, 'CarIdxOnPitRoad')[focus] === true;
    const spotter =
      isOnTrack && focus === scalarNumber(frame, 'PlayerCarIdx')
        ? scalarNumber(frame, 'CarLeftRight', CarLeftRight.Off)
        : null;
    const lanes = this.lanes.update(
      time,
      cars.filter((car) => car.onPitRoad === focusOnPitRoad),
      spotter,
      formation
    );
    for (const car of cars) {
      const lane = lanes.get(car.carIdx);
      if (!lane) continue;
      car.lane = lane.lane;
      car.laneSource = lane.source;
    }
  }

  snapshot(): RadarSnapshot {
    return this.latest;
  }

  private updateSpeeds(pcts: readonly unknown[], time: number): void {
    const dt = time - this.previousTime;
    // A paused sim or replay repeats SessionTime; keep the last speeds.
    if (this.previousTime >= 0 && dt === 0) return;
    const restart =
      this.previousTime < 0 ||
      dt < 0 ||
      dt > MAX_FRAME_GAP_S ||
      this.trackLength <= 0;
    this.previousTime = time;

    for (let carIdx = 0; carIdx < pcts.length; carIdx += 1) {
      const pct = numberAt(pcts, carIdx);
      const previous = this.previousPcts[carIdx] ?? -1;
      this.previousPcts[carIdx] = pct;
      if (restart || pct < 0 || previous < 0) {
        this.speeds[carIdx] = 0;
        continue;
      }
      const sample = (wrapDelta(pct, previous) * this.trackLength) / dt;
      if (Math.abs(sample) > MAX_PLAUSIBLE_SPEED_MS) {
        this.speeds[carIdx] = 0;
        continue;
      }
      const current = this.speeds[carIdx] ?? 0;
      this.speeds[carIdx] = current + SPEED_SMOOTHING * (sample - current);
    }
  }
}

const emptySnapshot = (version: number): RadarSnapshot => ({
  focusCarIdx: null,
  playerPct: 0,
  playerSpeed: 0,
  trackLength: 0,
  focusOnPitRoad: false,
  isOnTrack: false,
  formation: null,
  follow: null,
  cars: [],
  version,
});

/**
 * Any car in range moves every frame, so only an empty radar can stay
 * unchanged. The focus car's progress still counts there: with auto-hide off
 * the map keeps turning under an empty radar.
 */
const sameSnapshot = (
  previous: RadarSnapshot,
  next: Omit<RadarSnapshot, 'version'>
): boolean =>
  previous.cars.length === 0 &&
  next.cars.length === 0 &&
  previous.focusCarIdx === next.focusCarIdx &&
  previous.playerPct === next.playerPct &&
  previous.trackLength === next.trackLength &&
  previous.focusOnPitRoad === next.focusOnPitRoad &&
  previous.isOnTrack === next.isOnTrack &&
  previous.formation === next.formation &&
  previous.follow?.carIdx === next.follow?.carIdx &&
  previous.follow?.dist === next.follow?.dist;
