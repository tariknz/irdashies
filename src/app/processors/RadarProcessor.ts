import type {
  RadarCar,
  RadarSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import {
  CarLeftRight,
  DEFAULT_RADAR_TUNING,
  GlobalFlags,
  TrackLocation,
  type RadarProcessorTuning,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';
import { RadarLaneTracker, poleSign, separateInLaneCars } from './radarLanes';
import {
  computeFormation,
  paceFieldPoleLeft,
  PaceMode,
  parseGridPositions,
  parseStartingGrid,
  type Formation,
  type GridOptions,
} from './radarFormation';
import { RadarHazardTracker } from './radarHazards';
import {
  NO_POLE_SIDE_SETTINGS,
  type PoleSideSettings,
  type PoleSituation,
} from '@irdashies/types';
import { wrapDelta } from './radarMath';

/**
 * Metres either side of the focus car that still reach the renderer. The
 * widget's own range setting is applied there; this only bounds the payload,
 * so it sits above the largest range the settings allow.
 */
export const RADAR_MAX_RANGE_M = 120;

/** Flags under which nobody should be fighting for position. */
const CAUTION_FLAGS =
  GlobalFlags.Yellow |
  GlobalFlags.YellowWaving |
  GlobalFlags.Caution |
  GlobalFlags.CautionWaving;

/** Full-course caution: everybody slows, so nobody ahead is a hazard. */
const FULL_COURSE_CAUTION = GlobalFlags.Caution | GlobalFlags.CautionWaving;

/** A lap-distance jump faster than this is a tow or reset, not driving. */
const MAX_PLAUSIBLE_SPEED_MS = 150;
/** Frames further apart than this restart the speed average. */
const MAX_FRAME_GAP_S = 0.5;
/**
 * Seconds the speed average needs after a restart, during which every car
 * reads slower than it is and none may be judged a hazard.
 */
const SPEED_SETTLE_S = 1;
const RADAR_TICK_HZ = 25;
/** A standing grid has no table: its pole is on the left unless flipped. */
const GRID_POLE_LEFT = true;
/** Seconds the radar names the pole side after it was flipped. */
const POLE_NOTICE_S = 3;
/**
 * Frame step `speedSmoothing` is the weight for: one tick of `tickRateHz`,
 * which the radar was tuned on. Scaling the weight by the real step keeps
 * that response at any call rate.
 */
const SMOOTHING_STEP_S = 1 / RADAR_TICK_HZ;

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
  readonly tickRateHz = RADAR_TICK_HZ;

  private trackLength = 0;
  private readonly excluded = new Set<number>();
  /** The cars on the focus car's side of the pit wall, reused every tick. */
  private readonly sameSide: RadarCar[] = [];
  private previousPcts: number[] = [];
  private speeds: number[] = [];
  private previousTime = -1;
  /** Session time until which restarted speeds are still climbing back. */
  private speedsSettleUntil = -1;
  private readonly lanes: RadarLaneTracker;
  private readonly hazards = new RadarHazardTracker();
  private laneFocus = -1;
  private grid: GridOptions = {
    standingStart: false,
    columns: 2,
  };
  private paceCarIdx = -1;
  private session: Session | null = null;
  /** Grid positions for the session they were read for. */
  private gridPositions = new Map<number, number>();
  private gridSessionNum = NaN;

  private latest: RadarSnapshot = emptySnapshot(0);
  private trackId: number | undefined;
  /** Whether init() has set the pole side up for a track since the last lifecycle end. */
  private poleTrackKnown = false;
  /** The side the table gives for a pace field, and the side in use. */
  private tablePoleLeft = false;
  private poleLeft = false;
  /** A race start or a restart: the player corrects each on its own. */
  private situation: PoleSituation = 'start';
  /** Session time until which the radar says which side it flipped to. */
  private poleNoticeUntil = -Infinity;

  constructor(
    /** The dev view's tuning, read every frame so changes apply at once. */
    private readonly tuning: () => RadarProcessorTuning = () =>
      DEFAULT_RADAR_TUNING,
    /** The player's own pole side per track, read every frame. */
    private readonly poleSides: PoleSideSettings = NO_POLE_SIDE_SETTINGS
  ) {
    this.lanes = new RadarLaneTracker(tuning);
  }

  init(session: Session): void {
    this.trackLength = parseTrackLength(session?.WeekendInfo?.TrackLength);
    this.hazards.setTrackLength(this.trackLength);
    // TrackType is "road course", "short track", "super speedway", "dirt oval"
    // and so on; anything that is not road racing is an oval
    const trackType = session?.WeekendInfo?.TrackType ?? '';
    const previousTrackId = this.trackId;
    const previousTable = this.tablePoleLeft;
    this.trackId = session?.WeekendInfo?.TrackID;
    this.tablePoleLeft = paceFieldPoleLeft(
      this.trackId,
      session?.WeekendInfo?.TrackName,
      trackType !== '' && !/road|rally/i.test(trackType)
    );
    // iRacing sends session info again and again; only a new track starts the
    // pole side over, or a flip would lose its message and its situation. A
    // corrected track name that changes the table side starts it over too.
    if (
      !this.poleTrackKnown ||
      this.trackId !== previousTrackId ||
      this.tablePoleLeft !== previousTable
    ) {
      this.poleTrackKnown = true;
      this.situation = 'start';
      this.poleSides.setTrack(this.trackId, this.tablePoleLeft, this.situation);
      this.poleLeft =
        this.poleSides.override(this.trackId, this.situation) ??
        this.tablePoleLeft;
      this.lanes.setPoleLeft(this.poleLeft);
      this.poleNoticeUntil = -Infinity;
    }
    const options = session?.WeekendInfo?.WeekendOptions;
    this.grid = {
      standingStart: options?.StandingStart === 1,
      ...parseStartingGrid(options?.StartingGrid),
    };
    this.paceCarIdx = session?.DriverInfo?.PaceCarIdx ?? -1;
    this.session = session;
    this.gridSessionNum = NaN;
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
      const sessionNum = scalarNumber(frame, 'SessionNum', -1);
      if (sessionNum !== this.gridSessionNum) {
        this.gridSessionNum = sessionNum;
        this.gridPositions = parseGridPositions(this.session, sessionNum);
      }
      const paceMode = scalarNumber(frame, 'PaceMode', PaceMode.NotPacing);
      formation = computeFormation({
        focus,
        dists,
        pcts: pcts as readonly number[],
        surfaces: surfaces as readonly number[],
        onPitRoad: onPitRoad as readonly boolean[],
        excluded: this.excluded,
        paceMode,
        paceLines: valuesOf(frame, 'CarIdxPaceLine') as readonly number[],
        paceRows: valuesOf(frame, 'CarIdxPaceRow') as readonly number[],
        sessionState: scalarNumber(frame, 'SessionState'),
        speeds: this.speeds,
        gridMaxSpeedMs: this.tuning().gridMaxSpeedMs,
        lapsCompleted: valuesOf(
          frame,
          'CarIdxLapCompleted'
        ) as readonly number[],
        paceCarIdx: this.paceCarIdx,
        grid: this.grid,
        gridPositions: this.gridPositions,
      });
      this.applyPoleSide(time, formation, paceMode);
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
          relativeSpeed: (this.speeds[carIdx] ?? playerSpeed) - playerSpeed,
          lane: 0,
          laneSource: 'none',
          onPitRoad: onPitRoad[carIdx] === true,
          offTrack: surface === TrackLocation.OffTrack,
        });
      }
      cars.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
      // Cars across the pit wall are beside the track, not in a lane of it.
      const focusOnPit = onPitRoad[focus] === true;
      const sameSide = this.sameSide;
      sameSide.length = 0;
      for (const car of cars) {
        if (car.onPitRoad === focusOnPit) sameSide.push(car);
      }
      const spotterSpeaks = this.assignLanes(
        frame,
        time,
        focus,
        isOnTrack,
        sameSide,
        formation
      );
      // Without the spotter nobody says a car is not alongside: cars side by
      // side on a replay or a camera car must not be pulled apart.
      if (spotterSpeaks) separateInLaneCars(sameSide);
    }

    // The pedals are the player's, so they say nothing about a camera car.
    const drivingFocus =
      isOnTrack && focus >= 0 && focus === scalarNumber(frame, 'PlayerCarIdx');
    const brake = scalarNumber(frame, 'Brake');
    const flags = scalarNumber(frame, 'SessionFlags', 0);
    // Local yellows stay in: they are usually out for the very car we warn of.
    const hazards = this.hazards.update({
      time,
      focus,
      playerPct,
      pcts,
      speeds: this.speeds,
      surfaces,
      onPitRoad,
      excluded: this.excluded,
      settling: time < this.speedsSettleUntil,
      quiet:
        focus < 0 ||
        playerPct < 0 ||
        formation !== null ||
        (flags & FULL_COURSE_CAUTION) !== 0,
    });

    const next: Omit<RadarSnapshot, 'version'> = {
      focusCarIdx: focus >= 0 ? focus : null,
      playerPct: playerPct >= 0 ? playerPct : 0,
      playerSpeed: focus >= 0 ? (this.speeds[focus] ?? 0) : 0,
      trackLength: this.trackLength,
      focusOnPitRoad: focus >= 0 && onPitRoad[focus] === true,
      focusInPitBox:
        focus >= 0 && numberAt(surfaces, focus) === TrackLocation.InPitStall,
      isOnTrack,
      formation: formation?.kind ?? null,
      follow,
      focusBrake: drivingFocus && brake >= 0 ? brake : null,
      caution: (flags & CAUTION_FLAGS) !== 0,
      roadLane: formation
        ? poleSign(this.poleLeft) *
          ((formation.columns - 1) / 2 - formation.ownColumn)
        : 0,
      poleSideNotice: this.poleNoticeShown(time)
        ? this.poleLeft
          ? 'left'
          : 'right'
        : null,
      cars,
      hazards,
    };
    if (sameSnapshot(this.latest, next)) return;
    this.latest = { ...next, version: this.latest.version + 1 };
  }

  /** A dropped radar must not leave the flip key aimed at its last track. */
  dispose(): void {
    this.poleTrackKnown = false;
    this.poleSides.setTrack(undefined, false, 'start');
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    this.previousPcts = [];
    this.speeds = [];
    this.previousTime = -1;
    this.speedsSettleUntil = -1;
    this.lanes.reset();
    this.hazards.reset();
    this.laneFocus = -1;
    // Out of the session the flip key has no track to act on. A new session
    // number keeps the track: iRacing sends the session info again after it.
    if (event.type === 'disconnect') this.dispose();
    this.latest = emptySnapshot(this.latest.version + 1);
  }

  /**
   * The spotter speaks for the player's car only, and only while it is
   * driving; when the camera is on someone else, lanes come from memory and
   * pairing alone. Cars across the pit wall are beside the track, not in a
   * lane of it, so they stay out of the estimate. Returns whether the spotter
   * was listened to.
   */
  private assignLanes(
    frame: Telemetry,
    time: number,
    focus: number,
    isOnTrack: boolean,
    cars: RadarCar[],
    formation: Formation | null
  ): boolean {
    if (focus !== this.laneFocus) {
      this.lanes.reset();
      this.laneFocus = focus;
    }
    const spotter =
      isOnTrack && focus === scalarNumber(frame, 'PlayerCarIdx')
        ? scalarNumber(frame, 'CarLeftRight', CarLeftRight.Off)
        : null;
    const lanes = this.lanes.update(time, cars, spotter, formation);
    for (const car of cars) {
      const lane = lanes.get(car.carIdx);
      if (!lane) continue;
      car.lane = lane.lane;
      car.laneSource = lane.source;
    }
    // Off is the spotter saying nothing at all (LMU without positions, say).
    return spotter !== null && spotter !== CarLeftRight.Off;
  }

  /**
   * Follows the player's own pole side for this track, which a keybinding can
   * change at any time, and says so on the radar for a few seconds.
   */
  /** Within POLE_NOTICE_S of the flip, and not left over from a replay's future. */
  private poleNoticeShown(time: number): boolean {
    const left = this.poleNoticeUntil - time;
    return left > 0 && left <= POLE_NOTICE_S;
  }

  private applyPoleSide(
    time: number,
    formation: Formation | null,
    paceMode: number
  ): void {
    const situation: PoleSituation =
      formation?.kind === 'grid'
        ? 'grid'
        : paceMode === PaceMode.SingleFileRestart ||
            paceMode === PaceMode.DoubleFileRestart
          ? 'restart'
          : 'start';
    const tableLeft =
      situation === 'grid' ? GRID_POLE_LEFT : this.tablePoleLeft;
    const changedSituation = situation !== this.situation;
    if (changedSituation) {
      this.situation = situation;
      this.poleSides.setTrack(this.trackId, tableLeft, situation);
    }
    const side = this.poleSides.override(this.trackId, situation) ?? tableLeft;
    if (side === this.poleLeft) return;
    this.poleLeft = side;
    this.lanes.setPoleLeft(side);
    // Only a key press is worth a message, not the situation changing.
    if (!changedSituation) this.poleNoticeUntil = time + POLE_NOTICE_S;
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
    if (restart) this.speedsSettleUntil = time + SPEED_SETTLE_S;
    // Weight of the newest sample, scaled so the average responds the same
    // at any call rate.
    const smoothing = restart
      ? 0
      : 1 - (1 - this.tuning().speedSmoothing) ** (dt / SMOOTHING_STEP_S);

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
      this.speeds[carIdx] = current + smoothing * (sample - current);
    }
  }
}

const emptySnapshot = (version: number): RadarSnapshot => ({
  focusCarIdx: null,
  playerPct: 0,
  playerSpeed: 0,
  trackLength: 0,
  focusOnPitRoad: false,
  focusInPitBox: false,
  isOnTrack: false,
  formation: null,
  follow: null,
  focusBrake: null,
  caution: false,
  poleSideNotice: null,
  roadLane: 0,
  cars: [],
  hazards: [],
  version,
});

/**
 * Any car in range moves every frame, so only an empty radar can stay
 * unchanged (and a hazard ahead closes in, so it counts as a car). The focus
 * car's progress still counts there: with auto-hide off the map keeps
 * turning under an empty radar.
 */
const sameSnapshot = (
  previous: RadarSnapshot,
  next: Omit<RadarSnapshot, 'version'>
): boolean =>
  previous.cars.length === 0 &&
  next.cars.length === 0 &&
  previous.hazards.length === 0 &&
  next.hazards.length === 0 &&
  previous.focusCarIdx === next.focusCarIdx &&
  previous.playerPct === next.playerPct &&
  previous.playerSpeed === next.playerSpeed &&
  previous.focusBrake === next.focusBrake &&
  previous.caution === next.caution &&
  previous.poleSideNotice === next.poleSideNotice &&
  previous.roadLane === next.roadLane &&
  previous.trackLength === next.trackLength &&
  previous.focusOnPitRoad === next.focusOnPitRoad &&
  previous.focusInPitBox === next.focusInPitBox &&
  previous.isOnTrack === next.isOnTrack &&
  previous.formation === next.formation &&
  previous.follow?.carIdx === next.follow?.carIdx &&
  previous.follow?.dist === next.follow?.dist;
