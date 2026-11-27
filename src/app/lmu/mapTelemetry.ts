import {
  CarLeftRight,
  EngineWarnings,
  GlobalFlags,
  SessionState,
  TIMED_SESSION_LAPS,
  type Telemetry,
} from '@irdashies/types';
import {
  createLmuRelativePositionsBuffer,
  deriveLmuRelativePositions,
  summariseLmuBlindSpot,
} from './proximity';
import { lapTimeOrAbsent } from './sentinels';
import { lmuTrackWetness } from './trackWetness';
import { lmuCarCompound, lmuCompoundChannel } from './tireCompound';
import { lmuTrackLimitsChannel, lmuTrackLimitsMax } from './trackLimits';
import { lmuEnergyChannel } from './fuelEnergy';
import { lmuSessionUniqueId, type LmuSessionIdentity } from './sessionIdentity';
import {
  estimateLmuLapDistPct,
  lmuCompletedLaps,
  type LmuLapDistanceState,
} from './lapDistance';
import {
  refineLmuOpponentLapDistPcts,
  type LmuOpponentLapDistanceState,
} from './opponentLapDistance';
import type { LmuRestCell, LmuRestCells } from './rest/state';
import type { LmuLivePenaltyChannels } from './liveStandings/penalties';
import { isLmuRaceSession } from './mapSession';
import { lmuInCar, lmuInSession, type LmuGameState } from './gameState';
import {
  createLmuClassPositionState,
  updateLmuClassPositions,
} from './classPosition';

type Raw = import('./native').LmuRawTelemetry;

const PHASE_TO_SESSION_STATE: Record<number, number> = {
  0: SessionState.Invalid,
  1: SessionState.Warmup,
  2: SessionState.GetInCar,
  3: SessionState.ParadeLaps,
  4: SessionState.ParadeLaps,
  5: SessionState.Racing,
  6: SessionState.Racing,
  7: SessionState.Checkered,
  8: SessionState.CoolDown,
  9: SessionState.Racing,
};

/** Matches TrackLocation.NotInWorld, which consumers test with `> -1`. */
const TRACK_NOT_IN_WORLD = -1;
const TRACK_IN_PIT_STALL = 1;
const TRACK_APPROACHING_PITS = 2;
const TRACK_ON_TRACK = 3;

type Frame = Record<string, { value: unknown[] }>;

interface HeldCell<T> {
  value: T[];
}

const heldCells = new Map<string, HeldCell<unknown>>();
const scratchArrays = new Map<string, unknown[]>();
const NO_VALUES: readonly never[] = [];

const scratch = <T>(key: string): T[] => {
  let values = scratchArrays.get(key);
  if (!values) {
    values = [];
    scratchArrays.set(key, values);
  }
  return values as T[];
};

const hold = <T>(key: string, value: T): HeldCell<T> => {
  const cell = heldCells.get(key) as HeldCell<T> | undefined;
  if (cell && cell.value.length === 1 && Object.is(cell.value[0], value)) {
    return cell;
  }
  const next: HeldCell<T> = { value: [value] };
  heldCells.set(key, next);
  return next;
};

const num = (key: string, v: number | undefined) => hold(key, v ?? 0);
const bool = (key: string, v: boolean | number | undefined) =>
  hold(key, Boolean(v));

const sameValues = (
  held: readonly unknown[],
  values: ArrayLike<unknown>
): boolean => {
  if (held.length !== values.length) return false;
  for (let index = 0; index < held.length; index += 1) {
    if (!Object.is(held[index], values[index])) return false;
  }
  return true;
};

const copyNumbers = (values: ArrayLike<number>): number[] => {
  const copy = new Array<number>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    copy[index] = values[index];
  }
  return copy;
};

const copyValues = <T>(values: ArrayLike<T>): T[] => {
  const copy = new Array<T>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    copy[index] = values[index];
  }
  return copy;
};

const holdArray = <T>(
  key: string,
  values: ArrayLike<T> | undefined,
  copy: (values: ArrayLike<T>) => T[]
): HeldCell<T> => {
  const source = values ?? NO_VALUES;
  const cell = heldCells.get(key) as HeldCell<T> | undefined;
  if (cell && sameValues(cell.value, source)) return cell;
  const next: HeldCell<T> = { value: copy(source) };
  heldCells.set(key, next);
  return next;
};

const fillWith = <T>(
  out: T[],
  source: ArrayLike<number> | undefined,
  convert: (value: number) => T
): T[] => {
  if (!source) {
    out.length = 0;
    return out;
  }
  for (let index = 0; index < source.length; index += 1) {
    out[index] = convert(source[index]);
  }
  out.length = source.length;
  return out;
};

const isOne = (n: number) => n === 1;
const isNonZero = (n: number) => n !== 0;

/**
 * Whether a per-car slot holds a real car.
 *
 * The addon sizes its arrays to max(mID)+1 and writes only the slots of cars
 * present in scoring, so every gap in the id range keeps the zero a
 * Napi::Float64Array is created with. vehLapDistPct is the one array the
 * addon sentinel-fills with -1, which makes it the reliable discriminator.
 */
const isOccupied = (raw: Raw, carIdx: number) =>
  (raw.vehLapDistPct?.[carIdx] ?? -1) >= 0;

/**
 * Lap times, with anything non-positive reported as absent.
 *
 * -1 is the sentinel the rest of the app reads as "no time": formatTime
 * returns '' for a negative and renders 0 as "0:00.000", and the standings
 * cells pass their value straight to it. Keyed on the value rather than on
 * occupancy because 0 is never a legitimate lap time, so this also covers a
 * zero LMU writes for a car that is really there.
 */
const lapTimes = (out: number[], v: ArrayLike<number> | undefined) =>
  fillWith(out, v, lapTimeOrAbsent);

/** A lap time for a single car, under the same rule. */
const lapTime = (key: string, v: number | undefined) =>
  num(key, lapTimeOrAbsent(v));

/**
 * Per-car values where 0 is a legitimate reading, so only an empty slot may
 * become the sentinel.
 *
 * A car on its first lap genuinely has 0 completed laps, and createStandings
 * normalises a falsy lap count to 1; turning that 0 into -1 would corrupt the
 * lap-gap arithmetic for a real car.
 */
const occupied = (
  out: number[],
  v: ArrayLike<number> | undefined,
  raw: Raw,
  absent: number
): number[] => {
  if (!v) {
    out.length = 0;
    return out;
  }
  for (let carIdx = 0; carIdx < v.length; carIdx += 1) {
    out[carIdx] = isOccupied(raw, carIdx) ? v[carIdx] : absent;
  }
  out.length = v.length;
  return out;
};

const clampLapDistPct = (value: number) =>
  value < 0 ? -1 : Math.min(1, Math.max(0, value));

const carIdxLapScratch: number[] = [];
const carIdxLapCompletedScratch: number[] = [];
const carIdxLapDistPctScratch: number[] = [];
const carIdxLapsScratch = [carIdxLapScratch, carIdxLapCompletedScratch];

/**
 * Reused across frames. This runs at the poll rate, so the four arrays it
 * fills were ~250 allocations a second; and the derivation used to run three
 * times per frame -- here, again for CarLeftRight, and once more in the bridge
 * -- each pass rotating and taking an atan2 per car. It now runs once.
 */
const relativePositionsBuffer = createLmuRelativePositionsBuffer();

/**
 * Class-position state, held across frames so the ranking is only recomputed
 * when a place or a best lap actually moves rather than on all 64 frames a
 * second. See classPosition.ts.
 */
const classPositionState = createLmuClassPositionState();

export function mapLmuCarLeftRight(raw: Raw): CarLeftRight | null {
  return (
    summariseLmuBlindSpot(
      deriveLmuRelativePositions(raw, relativePositionsBuffer)
    )?.state ?? null
  );
}

function sessionFlags(raw: Raw): number {
  if (raw.gamePhase === 8) return GlobalFlags.Checkered;
  if (raw.gamePhase === 7) return GlobalFlags.Red;
  if (
    raw.gamePhase === 6 ||
    (raw.yellowFlagState >= 1 && raw.yellowFlagState <= 6)
  ) {
    // Preserve the yellow display while distinguishing an FCY from a sector
    // yellow for consumers such as the lap-history filter.
    return GlobalFlags.Yellow | GlobalFlags.Caution;
  }
  for (const flag of raw.sectorFlags) {
    if (flag === 1) return GlobalFlags.Yellow;
  }
  const playerFlag = raw.vehFlag?.[raw.playerVehicleIdx];
  if (playerFlag === 6) return GlobalFlags.Blue;
  return 0;
}

function carSessionFlags(raw: Raw, out: number[]): number[] {
  for (let carIdx = 0; carIdx < raw.vehIds.length; carIdx += 1) {
    let flags = 0;
    if (raw.vehFlag?.[carIdx] === 6) flags |= GlobalFlags.Blue;
    if (raw.vehUnderYellow?.[carIdx] === 1) flags |= GlobalFlags.Yellow;
    if (raw.vehFinishStatus?.[carIdx] === 3) flags |= GlobalFlags.Disqualify;
    out[carIdx] = flags;
  }
  out.length = raw.vehIds.length;
  return out;
}

function carSpeeds(
  raw: Raw,
  speeds: ArrayLike<number>,
  out: number[]
): number[] {
  for (let carIdx = 0; carIdx < speeds.length; carIdx += 1) {
    out[carIdx] = raw.vehTelemetryAvailable[carIdx] ? speeds[carIdx] : -1;
  }
  out.length = speeds.length;
  return out;
}

function trackLocations(raw: Raw, out: number[]): number[] {
  for (let carIdx = 0; carIdx < raw.vehInPits.length; carIdx += 1) {
    out[carIdx] = trackLocation(raw, carIdx);
  }
  out.length = raw.vehInPits.length;
  return out;
}

const validTime = (value: number | undefined): number | null =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : null;

export function mapLmuSectorTimes(
  sector1: number | undefined,
  sector1And2: number | undefined,
  lapTime?: number,
  out: (number | null)[] = []
): (number | null)[] {
  const first = validTime(sector1);
  const cumulativeSecond = validTime(sector1And2);
  const second =
    first !== null && cumulativeSecond !== null && cumulativeSecond > first
      ? cumulativeSecond - first
      : null;
  const fullLap = validTime(lapTime);
  const third =
    cumulativeSecond !== null && fullLap !== null && fullLap > cumulativeSecond
      ? fullLap - cumulativeSecond
      : null;
  out[0] = first;
  out[1] = second;
  out[2] = third;
  out.length = 3;
  return out;
}

function sectorIdx(rawSector: number | undefined): number {
  if (rawSector === 1) return 0;
  if (rawSector === 2) return 1;
  return 2;
}

function trackLocation(raw: Raw, carIdx: number): number {
  // An empty slot is not a car sitting on the track. Without this every index
  // up to max(mID) reported on-track, which consumers test with
  // `> TrackLocation.NotInWorld`.
  if (!isOccupied(raw, carIdx)) return TRACK_NOT_IN_WORLD;
  if (raw.vehInGarageStall[carIdx] || raw.vehPitState[carIdx] === 3) {
    return TRACK_IN_PIT_STALL;
  }
  if (raw.vehInPits[carIdx]) return TRACK_APPROACHING_PITS;
  return TRACK_ON_TRACK;
}

/**
 * Maps raw LMU shared-memory frames onto the iRacing-shaped Telemetry object.
 * Values without an LMU source default to 0/[]/false so downstream stores and
 * processors behave the same as when an iRacing telemetry var is absent.
 */
/**
 * The slot to focus on: the spectator camera's, or the player's own.
 *
 * Falls back exactly as the processors do, and for the same reason -- a camera
 * reading of -1 means nothing is focused, not that slot -1 is. The REST task
 * only ever lands an integer in range here, so there is no validation left to
 * do; what this adds is the fallback and one place to read it from.
 */
const focusCarIdx = (
  restCells: LmuRestCells | undefined,
  playerIdx: number
): number => {
  const focus = restCells?.focusCarIdx?.value?.[0];
  return typeof focus === 'number' && focus >= 0 ? focus : playerIdx;
};

/**
 * One LMU shared-memory snapshot as an iRacing-shaped telemetry frame, with
 * the REST answers and the game state folded in. A value LMU has no
 * equivalent for is published empty or neutral rather than left out.
 */
export function mapLmuTelemetry(
  raw: Raw,
  /**
   * Lap-distance integrator state, owned by the caller so it survives between
   * frames. Omitted -- as every spec does -- the fraction is the raw 5 Hz
   * scoring value, exactly as before.
   */
  lapDistanceState?: LmuLapDistanceState,
  /**
   * Per-car integrator state, owned by the caller for the same reason. Omitted
   * -- as every spec does -- opponents keep the raw 5 Hz scoring fraction.
   */
  opponentLapDistanceState?: LmuOpponentLapDistanceState,
  /**
   * Values from LMU's local REST API, polled outside this path. Omitted -- as
   * every spec does -- the channels it feeds are simply absent.
   */
  restCells?: LmuRestCells,
  /**
   * The session's identity, owned by the caller because telling one session
   * from the next needs memory of the last. Omitted -- as every spec does --
   * the id is derived from this snapshot alone, which cannot see a server
   * rolling a session of the same type on the same track.
   */
  sessionIdentity?: LmuSessionIdentity,
  /**
   * True when the sim has stopped writing shared memory, so the snapshot is
   * the last one it wrote rather than a current reading. Omitted -- as every
   * spec does -- the snapshot is taken at face value, which is what it was
   * before anything watched for this. See dataFreeze.ts.
   */
  dataFrozen?: boolean,
  /**
   * Which penalty each car is serving, and what a time penalty will cost.
   *
   * Built by the caller, because the only source is LMU's UI websocket and the
   * join is by driver name -- which this snapshot does not carry. The session
   * snapshot does, so the bridge keys the feed to the grid there and hands the
   * finished cells down. Omitted -- as every spec does -- the channels are
   * absent and the player's badge falls back to the stop estimate.
   */
  livePenalties?: LmuLivePenaltyChannels,
  /**
   * Where the player is, from LMU's GetGameState, polled once a second. When
   * known it decides IsOnTrack outright, and LmuDataStale except at the
   * monitor, where `dataFrozen` still has its say; the realtime and ignition
   * flags are not consulted. Omitted -- no REST
   * API, a tape that never recorded it, or as every spec does -- those
   * inferences from shared memory stand, as they did before. See
   * gameState.ts.
   */
  gameState?: LmuGameState
): Telemetry {
  const playerIdx =
    raw.playerHasVehicle && raw.playerVehicleIdx >= 0
      ? raw.playerVehicleIdx
      : -1;
  const scoringLapDistPct = raw.vehLapDistPct[playerIdx] ?? 0;
  // LMU publishes lap distance only in the 5 Hz scoring block, so between
  // scoring updates the position is advanced by speed x elapsed and
  // resynchronised on every update. Without it the fraction is byte-identical
  // between updates -- ~14 m apart at racing speed -- and LapTrace's sample
  // buffer, which drops anything that has not advanced, stored about five
  // samples a second.
  //
  // playerIdx < 0 is spectating or the garage, where elapsedTime is absent
  // too; anchoring the integrator on that fabricated pair would be worse than
  // leaving this path exactly as it was.
  const estimatedLapDistPct =
    lapDistanceState && playerIdx >= 0
      ? estimateLmuLapDistPct(lapDistanceState, {
          scoringPct: scoringLapDistPct,
          elapsedTime: raw.elapsedTime ?? -1,
          lapNumber: raw.lapNumber ?? -1,
          completedLaps: raw.vehTotalLaps[playerIdx],
          speedMs: raw.speed ?? 0,
          trackLengthM: raw.lapDist ?? 0,
        })
      : scoringLapDistPct;
  // The player's completed laps to go with that position, for LapCompleted
  // and the player's own CarIdxLap slots below.
  const playerCompletedLaps =
    lapDistanceState && playerIdx >= 0
      ? lmuCompletedLaps(lapDistanceState)
      : null;
  // The estimator passes the negative "no car here" sentinel straight through;
  // clamping here keeps the published value inside the [0, 1] contract this
  // mapper has always had.
  const lapDistPct = Math.min(1, Math.max(0, estimatedLapDistPct));
  const steeringMaxRad = ((raw.visualSteeringWheelRange ?? 0) * Math.PI) / 360;
  const relativePositions = deriveLmuRelativePositions(
    raw,
    relativePositionsBuffer
  );
  const blindSpot = summariseLmuBlindSpot(relativePositions);

  // Both clocks come from the player's mElapsedTime, measured at 100 Hz,
  // rather than scoring's mCurrentET at 5 Hz. They are the same quantity --
  // seconds since the session began -- but LapTrace timestamps every sample
  // with SessionTime, so the 5 Hz one gave a fine distance axis against a
  // 200 ms staircase in time. SessionTick also drives the processor host's
  // rate limits, which cannot throttle on a clock that stands still; the LMU
  // bridge passes sessionSecondsFrameClock because this is seconds, not
  // iRacing's 60 Hz ticks.
  //
  // mElapsedTime is absent with no player car (spectating, garage), hence the
  // fallback.
  const sessionClock =
    typeof raw.elapsedTime === 'number' && raw.elapsedTime >= 0
      ? raw.elapsedTime
      : raw.currentET;
  // Only a race can be lap-limited; practice and qualifying are always timed,
  // and an endurance race usually is too. In those, mMaxLaps is not a lap
  // count -- rF2 signals "no limit" with a value far beyond any real race, so
  // passing it through made the fuel calculator ask for a thousand laps' worth
  // of fuel. TIMED_SESSION_LAPS is what iRacing reports in the same situation,
  // and what every consumer already recognises.
  //
  // The upper bound is iRacing's own sentinel rather than an invented
  // threshold: at or above it, the number cannot be a real lap count whatever
  // encoding LMU chose for "unlimited".
  const hasLapLimit =
    isLmuRaceSession(raw.session) &&
    raw.maxLaps > 0 &&
    raw.maxLaps < TIMED_SESSION_LAPS;
  occupied(carIdxLapScratch, raw.vehTotalLaps, raw, -1);
  occupied(carIdxLapCompletedScratch, raw.vehTotalLaps, raw, -1);
  fillWith(carIdxLapDistPctScratch, raw.vehLapDistPct, clampLapDistPct);
  // The player's own slot takes the smoothed value too, so anything measuring
  // against the player sees continuous motion rather than a 5 Hz step.
  const carIdxLapDistPct = carIdxLapDistPctScratch;
  // Lap plus fraction is how standings and race projections measure progress,
  // so each refined fraction takes the lap count that goes with it.
  const carIdxLaps = carIdxLapsScratch;
  if (
    playerIdx >= 0 &&
    playerIdx < carIdxLapDistPct.length &&
    estimatedLapDistPct >= 0
  ) {
    carIdxLapDistPct[playerIdx] = lapDistPct;
    if (playerCompletedLaps !== null) {
      for (const laps of carIdxLaps) {
        if (playerIdx < laps.length) laps[playerIdx] = playerCompletedLaps;
      }
    }
  }
  // And every other car, from the same 100 Hz telemetry block. Without this
  // they sit at the 5 Hz scoring rate -- ~14 m steps on a long circuit -- and
  // CarSpeedsProcessor differentiates those steps into opponent speed, which
  // the slow-car and faster-car warnings then threshold on.
  if (opponentLapDistanceState) {
    refineLmuOpponentLapDistPcts(
      opponentLapDistanceState,
      carIdxLapDistPct,
      {
        scoringPcts: raw.vehLapDistPct,
        speeds: raw.vehSpeed,
        lapNumbers: raw.vehLapNumber,
        completedLaps: raw.vehTotalLaps,
        elapsedTimes: raw.vehElapsedTime,
        telemetryAvailable: raw.vehTelemetryAvailable,
        trackLengthM: raw.lapDist,
        playerCarIdx: playerIdx,
      },
      carIdxLaps
    );
  }
  // Both position channels come out of one ordering pass, which must run
  // before either is read. LMU publishes mPlace but nothing per class, and the
  // standings read class position; left empty it fell through to the
  // qualifying grid, which under practice is entry order and never changes.
  updateLmuClassPositions(classPositionState, {
    classes: raw.vehClass,
    places: raw.vehPlaces,
    bestLapTimes: raw.vehBestLapTime,
    lapDistPcts: raw.vehLapDistPct,
    isRace: isLmuRaceSession(raw.session),
  });
  // Boundary note: a handful of generated Telemetry keys (e.g. SessionTime) are
  // typed with an `undefined[]` value shape although the iRacing native layer
  // emits numbers there at runtime. Building into a plain record and casting is
  // the same boundary trick; values match iRacing's observable behaviour.
  const t: Frame = {
    // Session-level
    SessionTick: num('SessionTick', sessionClock),
    SessionNum: num('SessionNum', raw.session),
    // Derived, because LMU has no unique id and the session type is not one.
    // Must agree with WeekendInfo.SubSessionID: consumers compare the two
    // halves of the same fact. See sessionIdentity.ts.
    SessionUniqueID: num(
      'SessionUniqueID',
      sessionIdentity?.current() ?? lmuSessionUniqueId(raw)
    ),
    SessionState: num(
      'SessionState',
      PHASE_TO_SESSION_STATE[raw.gamePhase] ?? 0
    ),
    SessionTime: num('SessionTime', sessionClock),
    SessionTimeRemain: num('SessionTimeRemain', raw.sessionTimeRemaining),
    SessionTimeTotal: num('SessionTimeTotal', raw.endET),
    SessionLapsRemain: num(
      'SessionLapsRemain',
      hasLapLimit
        ? Math.max(
            0,
            raw.maxLaps -
              (playerIdx >= 0 ? (raw.vehTotalLaps[playerIdx] ?? 0) : 0)
          )
        : TIMED_SESSION_LAPS
    ),
    SessionLapsTotal: num(
      'SessionLapsTotal',
      hasLapLimit ? raw.maxLaps : TIMED_SESSION_LAPS
    ),
    SessionTimeOfDay: num('SessionTimeOfDay', raw.timeOfDay),
    SessionFlags: num('SessionFlags', sessionFlags(raw)),
    // Metric. iRacing carries the driver's own unit preference here and widgets
    // resolve 'auto' from it; LMU's shared memory has no equivalent, and 0
    // (imperial) meant every 'auto' widget showed mph for a sim whose own UI,
    // pit limits and timing are all metric.
    DisplayUnits: num('DisplayUnits', 1),
    IsReplayPlaying: bool('IsReplayPlaying', false),
    ReplayFrameNum: num('ReplayFrameNum', 0),
    ReplayFrameNumEnd: num('ReplayFrameNumEnd', 0),

    // Player
    PlayerCarIdx: num('PlayerCarIdx', playerIdx),
    // LMU keeps no incident count. Consumers that need to know whether the lap
    // still counts read LmuLapInvalidated below instead.
    PlayerCarMyIncidentCount: num('PlayerCarMyIncidentCount', 0),
    LmuLapInvalidated: bool('LmuLapInvalidated', raw.lapInvalidated === true),
    PlayerCarTeamIncidentCount: num('PlayerCarTeamIncidentCount', 0),
    PlayerCarTowTime: num('PlayerCarTowTime', 0),
    PlayerCarInPitStall: bool(
      'PlayerCarInPitStall',
      playerIdx >= 0 &&
        (raw.vehInGarageStall[playerIdx] || raw.vehPitState[playerIdx] === 3)
    ),
    PlayerTireCompound: num(
      'PlayerTireCompound',
      lmuCarCompound(raw.vehWheelCompounds, playerIdx)
    ),
    PlayerFastRepairsUsed: num('PlayerFastRepairsUsed', 0),
    PlayerTrackSurface: num(
      'PlayerTrackSurface',
      playerIdx >= 0 ? trackLocation(raw, playerIdx) : TRACK_NOT_IN_WORLD
    ),
    PlayerCarPosition: num('PlayerCarPosition', raw.vehPlaces[playerIdx] ?? 0),
    PlayerCarClass: num('PlayerCarClass', raw.vehClass[playerIdx] ?? 0),
    // The car the overlays are about, which is not the player's while
    // spectating -- and while spectating `playerHasVehicle` is false, so
    // `playerIdx` is -1 and there would be nothing to focus on at all.
    //
    // Every processor derives its focus from this one channel with the same
    // `CamCarIdx >= 0 ? CamCarIdx : driverCarIdx` fallback (StandingsProcessor,
    // RelativeGapProcessor, RadarProcessor, SessionTimingProcessor,
    // FuelProjectionProcessor, TrackStateProcessor), so publishing the watched
    // slot here is the whole of following the camera: there is no change to
    // detect and nothing to subscribe to, because it is re-read every frame.
    //
    // This used to be hardcoded to `playerIdx`, which made every widget show
    // the viewer's own car -- or no car -- whoever the camera was on.
    CamCarIdx: num('CamCarIdx', focusCarIdx(restCells, playerIdx)),
    PlayerCarPitSvStatus: num('PlayerCarPitSvStatus', 0),
    CarLeftRight: num('CarLeftRight', blindSpot?.state ?? CarLeftRight.Off),

    // Per-car
    CarIdxLap: holdArray('CarIdxLap', carIdxLapScratch, copyNumbers),
    CarIdxLapCompleted: holdArray(
      'CarIdxLapCompleted',
      carIdxLapCompletedScratch,
      copyNumbers
    ),
    CarIdxLapDistPct: holdArray(
      'CarIdxLapDistPct',
      carIdxLapDistPct,
      copyNumbers
    ),
    CarIdxTrackSurface: holdArray(
      'CarIdxTrackSurface',
      trackLocations(raw, scratch('CarIdxTrackSurface')),
      copyNumbers
    ),
    CarIdxOnPitRoad: holdArray(
      'CarIdxOnPitRoad',
      fillWith(scratch<boolean>('CarIdxOnPitRoad'), raw.vehInPits, isOne),
      copyValues
    ),
    CarIdxClassPosition: holdArray(
      'CarIdxClassPosition',
      classPositionState.positions,
      copyNumbers
    ),
    // Outright position. A race takes the sim's own mPlace, which already
    // accounts for laps and sector order; practice and qualifying take the
    // best-lap ordering above, because LMU leaves mPlace at entry order there --
    // and the standings sort their rows on this, so a correct class column was
    // still being rendered in car-number order.
    CarIdxPosition: holdArray(
      'CarIdxPosition',
      isLmuRaceSession(raw.session)
        ? raw.vehPlaces
        : classPositionState.overall,
      copyNumbers
    ),
    CarIdxClass: holdArray(
      'CarIdxClass',
      occupied(scratch('CarIdxClass'), raw.vehClass, raw, -1),
      copyNumbers
    ),
    CarIdxF2Time: holdArray(
      'CarIdxF2Time',
      raw.vehTimeBehindLeader,
      copyNumbers
    ),
    CarIdxEstTime: holdArray('CarIdxEstTime', raw.vehTimeIntoLap, copyNumbers),
    CarIdxLastLapTime: holdArray(
      'CarIdxLastLapTime',
      lapTimes(scratch('CarIdxLastLapTime'), raw.vehLastLapTime),
      copyNumbers
    ),
    CarIdxBestLapTime: holdArray(
      'CarIdxBestLapTime',
      lapTimes(scratch('CarIdxBestLapTime'), raw.vehBestLapTime),
      copyNumbers
    ),
    CarIdxGear: holdArray('CarIdxGear', undefined, copyNumbers),
    // The front-left of each car, which is all a one-value-per-car channel can
    // say about a grid that may be on four different compounds. The whole set
    // goes out beside it as LmuCarIdxWheelCompounds.
    CarIdxTireCompound: holdArray(
      'CarIdxTireCompound',
      lmuCompoundChannel(raw.vehWheelCompounds, scratch('CarIdxTireCompound')),
      copyNumbers
    ),
    LmuCarIdxWheelCompounds: holdArray(
      'LmuCarIdxWheelCompounds',
      raw.vehWheelCompounds,
      copyNumbers
    ),
    // Points, not the sim's steps: the step count is an encoding detail of this
    // sim, and the ceiling has to be comparable with the figure.
    LmuCarIdxTrackLimitsPoints: holdArray(
      'LmuCarIdxTrackLimitsPoints',
      lmuTrackLimitsChannel(
        raw.vehTrackLimitsSteps,
        raw.trackLimitsStepsPerPoint,
        scratch('LmuCarIdxTrackLimitsPoints')
      ),
      copyNumbers
    ),
    // One figure per car: virtual energy where the car runs on it, fuel
    // otherwise. Which budget applies is a property of the car, not the session,
    // so the choice is made per car here rather than once for the grid.
    // Count only: scoring has no field for which penalty it is.
    LmuCarIdxPenalties: holdArray(
      'LmuCarIdxPenalties',
      raw.vehNumPenalties,
      copyNumbers
    ),
    // The sim's own per-car finish status, which names the flag outright.
    LmuCarIdxFinishStatus: holdArray(
      'LmuCarIdxFinishStatus',
      raw.vehFinishStatus,
      copyNumbers
    ),
    LmuCarIdxEnergyRemaining: holdArray(
      'LmuCarIdxEnergyRemaining',
      lmuEnergyChannel(
        raw.vehFuelFraction,
        raw.vehVirtualEnergy,
        scratch('LmuCarIdxEnergyRemaining')
      ),
      copyNumbers
    ),
    LmuTrackLimitsPointsMax: num(
      'LmuTrackLimitsPointsMax',
      lmuTrackLimitsMax(
        raw.trackLimitsStepsPerPenalty,
        raw.trackLimitsStepsPerPoint
      ) ?? 0
    ),
    CarIdxSessionFlags: holdArray(
      'CarIdxSessionFlags',
      carSessionFlags(raw, scratch('CarIdxSessionFlags')),
      copyNumbers
    ),
    CarDistAhead: holdArray('CarDistAhead', undefined, copyNumbers),
    CarDistBehind: holdArray('CarDistBehind', undefined, copyNumbers),
    // Copied, like the three numeric channels below. `available` is the
    // reusable buffer that deriveLmuRelativePositions overwrites in place
    // every frame, so publishing the reference handed consumers an array that
    // changed under them -- anything holding a previous frame to compare
    // against, and anything serialising one later, saw this frame's values.
    LmuCarIdxRelativeAvailable: holdArray(
      'LmuCarIdxRelativeAvailable',
      relativePositions?.available,
      copyValues
    ),
    LmuCarIdxRelativeLateral: holdArray(
      'LmuCarIdxRelativeLateral',
      relativePositions?.lateral,
      copyValues
    ),
    LmuCarIdxRelativeLongitudinal: holdArray(
      'LmuCarIdxRelativeLongitudinal',
      relativePositions?.longitudinal,
      copyValues
    ),
    LmuCarIdxRelativeHeading: holdArray(
      'LmuCarIdxRelativeHeading',
      relativePositions?.heading,
      copyValues
    ),
    // Fore(+)/aft(-) metres of the nearest car each side, straight from the
    // 100 Hz world positions. A display of the car's position alongside reads
    // this instead of subtracting lap-distance percentages, which the 5 Hz
    // scoring block quantises far more coarsely than such a display spans.
    LmuBlindSpotLeftLongitudinal: hold(
      'LmuBlindSpotLeftLongitudinal',
      blindSpot?.leftLongitudinalM ?? null
    ),
    LmuBlindSpotRightLongitudinal: hold(
      'LmuBlindSpotRightLongitudinal',
      blindSpot?.rightLongitudinalM ?? null
    ),
    LmuPlayerYaw: hold('LmuPlayerYaw', relativePositions?.playerYaw ?? null),
  };
  if (raw.vehSpeed) {
    t.LmuCarIdxSpeed = holdArray(
      'LmuCarIdxSpeed',
      carSpeeds(raw, raw.vehSpeed, scratch('LmuCarIdxSpeed')),
      copyNumbers
    );
  }

  // Reference assignments, not copies: the poller replaces a cell when its
  // value changes, so there is nothing to clone and a frame allocates nothing
  // for these. Absent cells leave the channel undefined, which is what keeps
  // iRacing and every existing spec unaffected.
  //
  // The cast bridges two deliberate facts: `t` above stages mutable cells, and
  // a REST cell is readonly so an in-place write to one is a type error (see
  // rest/state.ts). Handed over by reference and never written to here.
  const staged = (cell: LmuRestCell<unknown>) => cell as { value: unknown[] };
  if (restCells?.pitStopTime) {
    t.LmuPitStopTime = staged(restCells.pitStopTime);
  }
  if (restCells?.repairTime) t.LmuRepairTime = staged(restCells.repairTime);
  if (restCells?.penaltySeconds) {
    t.LmuPenaltySeconds = staged(restCells.penaltySeconds);
  }
  // The penalty kind, and a time penalty's magnitude, from the sim's UI
  // websocket by way of the bridge -- the one source that states either, and
  // states them per car. Reference assignments like the REST cells above and
  // for the same reason. Absent when that socket is not answering, which is
  // what sends the player's badge back to the estimate-derived fallback and
  // leaves every other car without one. See liveStandings/.
  if (livePenalties) {
    t.LmuCarIdxPenaltyKind = staged(livePenalties.kind);
    t.LmuCarIdxPenaltySeconds = staged(livePenalties.penaltySeconds);
  }
  if (restCells?.refuelTarget) {
    t.LmuRefuelTarget = staged(restCells.refuelTarget);
  }
  if (restCells?.refuelTargetIsVirtualEnergy) {
    t.LmuRefuelTargetIsVirtualEnergy = staged(
      restCells.refuelTargetIsVirtualEnergy
    );
  }
  if (restCells?.brakeWear) t.LmuBrakeWear = staged(restCells.brakeWear);
  if (restCells?.suspensionDamage) {
    t.LmuSuspensionDamage = staged(restCells.suspensionDamage);
  }
  if (restCells?.aeroDamage) t.LmuAeroDamage = staged(restCells.aeroDamage);

  if (raw.dentSeverity) {
    t.LmuDentSeverity = holdArray(
      'LmuDentSeverity',
      raw.dentSeverity,
      copyNumbers
    );
  }
  if (raw.wheelDetached) {
    t.LmuWheelDetached = holdArray(
      'LmuWheelDetached',
      fillWith(
        scratch<boolean>('LmuWheelDetached'),
        raw.wheelDetached,
        isNonZero
      ),
      copyValues
    );
  }
  if (raw.bodyDetached !== undefined) {
    t.LmuBodyDetached = hold('LmuBodyDetached', raw.bodyDetached);
  }
  if (raw.lastImpactET !== undefined) {
    t.LmuLastImpactET = hold('LmuLastImpactET', raw.lastImpactET);
  }
  if (raw.lastImpactPos) {
    t.LmuLastImpactPos = holdArray(
      'LmuLastImpactPos',
      raw.lastImpactPos,
      copyNumbers
    );
  }

  // Shared memory, unlike the cells above. The addon always writes these when
  // LMU is running, so the guard is only for a tape or a build predating the
  // export -- not for a car without a hybrid system, which reports 0. A
  // consumer wanting "does this car use virtual energy?" should ask the pit
  // menu via LmuRefuelTargetIsVirtualEnergy, not infer it from a 0 here.
  if (raw.virtualEnergy !== undefined) {
    t.LmuVirtualEnergy = num('LmuVirtualEnergy', raw.virtualEnergy);
  }
  if (raw.stateOfCharge !== undefined) {
    t.LmuStateOfCharge = num('LmuStateOfCharge', raw.stateOfCharge);
  }
  if (raw.regen !== undefined) t.LmuRegen = num('LmuRegen', raw.regen);

  // LMU reports steering as a fraction of the full wheel range; iRacing uses radians.
  t.SteeringWheelAngle = num(
    'SteeringWheelAngle',
    -(raw.filteredSteering ?? 0) * steeringMaxRad
  );
  t.Throttle = num('Throttle', raw.filteredThrottle);
  t.Brake = num('Brake', raw.filteredBrake);
  t.Clutch = num(
    'Clutch',
    raw.filteredClutch === undefined ? undefined : 1 - raw.filteredClutch
  );
  t.Gear = num('Gear', raw.gear);
  t.RPM = num('RPM', raw.engineRPM);
  // The lap that goes with LapDistPct rather than LMU's counter as it stands:
  // the counter flips at the timing line, which can be well short of where
  // the position wraps, and anything pairing the two -- the fuel calculator
  // does -- then saw the line twice. Moved in the same frame as the position.
  t.Lap = num(
    'Lap',
    lapDistanceState && playerIdx >= 0 && lapDistanceState.lap !== null
      ? lapDistanceState.lap
      : raw.lapNumber
  );
  t.LapCompleted = num(
    'LapCompleted',
    playerCompletedLaps ?? raw.vehTotalLaps[playerIdx] ?? 0
  );
  t.LapDistPct = num('LapDistPct', lapDistPct);
  t.LapBestLapTime = lapTime('LapBestLapTime', raw.vehBestLapTime[playerIdx]);
  t.LapLastLapTime = lapTime('LapLastLapTime', raw.vehLastLapTime[playerIdx]);
  // LMU's own delta to the player's best lap, negative when ahead -- what
  // iRacing calls the delta to the session best. Only meaningful once there is
  // a best lap: until then LMU reports 0, which would read as dead level.
  const hasBestLap = (raw.vehBestLapTime[playerIdx] ?? 0) > 0;
  const deltaBest = raw.deltaBest;
  const deltaBestOk =
    hasBestLap && typeof deltaBest === 'number' && Number.isFinite(deltaBest);
  t.LapDeltaToSessionBestLap = num(
    'LapDeltaToSessionBestLap',
    deltaBestOk ? deltaBest : 0
  );
  t.LapDeltaToSessionBestLap_OK = bool(
    'LapDeltaToSessionBestLap_OK',
    deltaBestOk
  );
  t.LapCurrentLapTime = num(
    'LapCurrentLapTime',
    Math.max(0, (raw.elapsedTime ?? 0) - (raw.lapStartET ?? 0))
  );
  t.LmuCurrentSectorTimes = holdArray(
    'LmuCurrentSectorTimes',
    mapLmuSectorTimes(
      raw.vehCurSector1?.[playerIdx],
      raw.vehCurSector2?.[playerIdx],
      undefined,
      scratch('LmuCurrentSectorTimes')
    ),
    copyValues
  );
  t.LmuLastSectorTimes = holdArray(
    'LmuLastSectorTimes',
    mapLmuSectorTimes(
      raw.vehLastSector1?.[playerIdx],
      raw.vehLastSector2?.[playerIdx],
      raw.vehLastLapTime?.[playerIdx],
      scratch('LmuLastSectorTimes')
    ),
    copyValues
  );
  t.LmuBestSectorTimes = holdArray(
    'LmuBestSectorTimes',
    mapLmuSectorTimes(
      raw.vehBestSector1?.[playerIdx],
      raw.vehBestSector2?.[playerIdx],
      raw.vehBestLapTime?.[playerIdx],
      scratch('LmuBestSectorTimes')
    ),
    copyValues
  );
  t.LmuSectorIdx = num('LmuSectorIdx', sectorIdx(raw.vehSector?.[playerIdx]));
  t.Speed = num('Speed', raw.speed);
  t.Yaw = num('Yaw', 0);
  t.YawNorth = num('YawNorth', 0);
  t.Pitch = num('Pitch', 0);
  t.Roll = num('Roll', 0);
  t.SteeringWheelAngleMax = num('SteeringWheelAngleMax', steeringMaxRad);
  if (raw.localAccel) {
    t.LatAccel = num('LatAccel', raw.localAccel[0]);
    t.LongAccel = num('LongAccel', -raw.localAccel[2]);
  }

  const tyreTemperature = raw.tyreTemperature;
  const tyrePressure = raw.tyrePressure;
  const tyreWear = raw.tyreWear;
  const brakePressure = raw.brakePressure;
  const suspensionDeflection = raw.suspensionDeflection;
  if (tyreTemperature?.[0] !== undefined) {
    t.LFtempCL = num('LFtempCL', tyreTemperature[0]);
    t.LFtempCM = num('LFtempCM', tyreTemperature[1]);
    t.LFtempCR = num('LFtempCR', tyreTemperature[2]);
  }
  if (tyrePressure?.[0] !== undefined) {
    t.LFcoldPressure = num('LFcoldPressure', tyrePressure[0]);
  }
  if (tyreWear?.[0] !== undefined) {
    t.LFwearL = num('LFwearL', tyreWear[0]);
    t.LFwearM = num('LFwearM', tyreWear[0]);
    t.LFwearR = num('LFwearR', tyreWear[0]);
  }
  if (brakePressure?.[0] !== undefined) {
    t.LFbrakeLinePress = num('LFbrakeLinePress', brakePressure[0]);
  }
  if (suspensionDeflection?.[0] !== undefined) {
    t.LFshockDefl = num('LFshockDefl', suspensionDeflection[0]);
  }
  if (tyreTemperature?.[3] !== undefined) {
    t.RFtempCL = num('RFtempCL', tyreTemperature[3]);
    t.RFtempCM = num('RFtempCM', tyreTemperature[4]);
    t.RFtempCR = num('RFtempCR', tyreTemperature[5]);
  }
  if (tyrePressure?.[1] !== undefined) {
    t.RFcoldPressure = num('RFcoldPressure', tyrePressure[1]);
  }
  if (tyreWear?.[1] !== undefined) {
    t.RFwearL = num('RFwearL', tyreWear[1]);
    t.RFwearM = num('RFwearM', tyreWear[1]);
    t.RFwearR = num('RFwearR', tyreWear[1]);
  }
  if (brakePressure?.[1] !== undefined) {
    t.RFbrakeLinePress = num('RFbrakeLinePress', brakePressure[1]);
  }
  if (suspensionDeflection?.[1] !== undefined) {
    t.RFshockDefl = num('RFshockDefl', suspensionDeflection[1]);
  }
  if (tyreTemperature?.[6] !== undefined) {
    t.LRtempCL = num('LRtempCL', tyreTemperature[6]);
    t.LRtempCM = num('LRtempCM', tyreTemperature[7]);
    t.LRtempCR = num('LRtempCR', tyreTemperature[8]);
  }
  if (tyrePressure?.[2] !== undefined) {
    t.LRcoldPressure = num('LRcoldPressure', tyrePressure[2]);
  }
  if (tyreWear?.[2] !== undefined) {
    t.LRwearL = num('LRwearL', tyreWear[2]);
    t.LRwearM = num('LRwearM', tyreWear[2]);
    t.LRwearR = num('LRwearR', tyreWear[2]);
  }
  if (brakePressure?.[2] !== undefined) {
    t.LRbrakeLinePress = num('LRbrakeLinePress', brakePressure[2]);
  }
  if (suspensionDeflection?.[2] !== undefined) {
    t.LRshockDefl = num('LRshockDefl', suspensionDeflection[2]);
  }
  if (tyreTemperature?.[9] !== undefined) {
    t.RRtempCL = num('RRtempCL', tyreTemperature[9]);
    t.RRtempCM = num('RRtempCM', tyreTemperature[10]);
    t.RRtempCR = num('RRtempCR', tyreTemperature[11]);
  }
  if (tyrePressure?.[3] !== undefined) {
    t.RRcoldPressure = num('RRcoldPressure', tyrePressure[3]);
  }
  if (tyreWear?.[3] !== undefined) {
    t.RRwearL = num('RRwearL', tyreWear[3]);
    t.RRwearM = num('RRwearM', tyreWear[3]);
    t.RRwearR = num('RRwearR', tyreWear[3]);
  }
  if (brakePressure?.[3] !== undefined) {
    t.RRbrakeLinePress = num('RRbrakeLinePress', brakePressure[3]);
  }
  if (suspensionDeflection?.[3] !== undefined) {
    t.RRshockDefl = num('RRshockDefl', suspensionDeflection[3]);
  }

  // Environment
  t.TrackTemp = num('TrackTemp', raw.trackTemp);
  t.TrackTempCrew = num('TrackTempCrew', raw.trackTemp);
  t.AirTemp = num('AirTemp', raw.ambientTemp);
  t.TrackWetness = num('TrackWetness', lmuTrackWetness(raw.avgPathWetness));
  t.Skies = num('Skies', raw.cloudCoverage);
  // No WindVel or WindDir: LMU simulates no wind, and its wind vector is
  // always zero. Published, that read as a dead calm with the arrow fixed on a
  // headwind in every widget showing wind; absent, they show no reading.
  // LMU does not expose humidity; leave it absent rather than report dry air.
  t.FogLevel = num('FogLevel', 0);
  t.Precipitation = num('Precipitation', raw.raining);
  t.WeatherDeclaredWet = bool('WeatherDeclaredWet', raw.raining > 0);

  // Car condition
  t.WaterTemp = num('WaterTemp', raw.engineWaterTemp);
  t.OilTemp = num('OilTemp', raw.engineOilTemp);
  t.FuelLevel = num('FuelLevel', raw.fuel);
  // Derived, because LMU publishes litres and a capacity on the player's
  // 100 Hz telemetry but no fraction there -- mFuelFraction is per-car on the
  // 5 Hz scoring block, and its scale is unverified.
  //
  // 0 for "capacity unknown" cannot be improved from here: the fuel
  // processor's reader coerces a missing value to 0 on the way out, and
  // FuelProjectionSnapshot types the field as a required number, so there is
  // no way to express absence across that boundary. It is harmless because
  // calculateRealTankCapacity only trusts a fraction between 0.01 and 0.99
  // and otherwise estimates the tank, which is what absence would do anyway.
  t.FuelLevelPct = num(
    'FuelLevelPct',
    raw.fuelCapacity && raw.fuel !== undefined ? raw.fuel / raw.fuelCapacity : 0
  );
  t.EngineWarnings = num(
    'EngineWarnings',
    raw.speedLimiterActive || raw.speedLimiter
      ? EngineWarnings.PitSpeedLimiter
      : 0
  );
  t.ShiftGrindRPM = num('ShiftGrindRPM', raw.engineMaxRPM ?? 0);
  t.ThrottleRaw = num('ThrottleRaw', raw.unfilteredThrottle);
  t.BrakeRaw = num('BrakeRaw', raw.unfilteredBrake);
  t.ClutchRaw = num(
    'ClutchRaw',
    raw.unfilteredClutch === undefined ? undefined : 1 - raw.unfilteredClutch
  );
  t.BrakeABSactive = bool('BrakeABSactive', raw.absActive);
  // Percent front, which is what dcBrakeBias means and what the widget
  // formats with a '%' unit. LMU publishes only mRearBrakeBias, as a 0-1
  // fraction -- there is no mFrontBrakeBias, front is its complement -- so the
  // complement alone gave 0.508 where 50.8 was wanted, and the widget showed a
  // bias of "0.5%" that barely moved as it was adjusted.
  t.dcBrakeBias = num(
    'dcBrakeBias',
    raw.rearBrakeBias === undefined ? 0 : (1 - raw.rearBrakeBias) * 100
  );
  // Driver-adjustable dials.
  //
  // LMU publishes each as a setting plus the top of its own scale, and a car
  // without the control reports 0 for both -- so the max is the only thing
  // that separates "ABS turned off" from "no ABS fitted". A channel is
  // published only when its max is positive, because CarSystemsProcessor
  // discovers rows by which variables a frame carries and keeps them for the
  // rest of the session: publishing a flat 0 would give every LMU car a row
  // for every control, each reading "off".
  //
  // dcPeakBrakeBias is deliberately not set. It used to carry a copy of
  // dcBrakeBias, which put a second column on screen -- labelled Rear Brake
  // Valve -- showing the same percentage as the brake bias beside it.
  //
  // LMU's brake migration has no home either, for the same reason: the only
  // free brake channels are named Rear Brake Valve and Brake Bias Target in
  // the catalogue, and a migration reading under either name is worse than an
  // absent row. raw.migration is exported and waiting; giving it a column
  // needs a label that does not come from an iRacing CarPath, which is a
  // change to shared code rather than to this mapping.
  if ((raw.absMax ?? 0) > 0) t.dcABS = num('dcABS', raw.abs);
  if ((raw.motorMapMax ?? 0) > 0) {
    t.dcEnginePower = num('dcEnginePower', raw.motorMap);
  }
  if ((raw.frontAntiSwayMax ?? 0) > 0) {
    t.dcAntiRollFront = num('dcAntiRollFront', raw.frontAntiSway);
  }
  if ((raw.rearAntiSwayMax ?? 0) > 0) {
    t.dcAntiRollRear = num('dcAntiRollRear', raw.rearAntiSway);
  }
  if ((raw.tcMax ?? 0) > 0) {
    t.dcTractionControl = num('dcTractionControl', raw.tc);
  }
  if ((raw.tcSlipMax ?? 0) > 0) t.LmuTCSlip = num('LmuTCSlip', raw.tcSlip);
  if ((raw.tcCutMax ?? 0) > 0) t.LmuTCCut = num('LmuTCCut', raw.tcCut);
  t.dcPitSpeedLimiterToggle = bool('dcPitSpeedLimiterToggle', raw.speedLimiter);
  t.PitstopActive = bool('PitstopActive', false);
  t.OnPitRoad = bool(
    'OnPitRoad',
    playerIdx >= 0 ? raw.vehInPits[playerIdx] === 1 : false
  );
  // The sim's own answer when there is one: in the car while driving or
  // paused, in the session at the monitor too.
  //
  // Without it, three conditions, matching TinyPedal's own test for LMU: the
  // data is flowing, the player has a slot, and either the sim says realtime
  // or the ignition is on. The first is the one that was missing -- a frozen
  // snapshot keeps reporting realtime forever, which is why ending a session
  // left every widget gated on this one on screen. Ignition is the second
  // half of TinyPedal's OR: a driver sitting in the car before realtime
  // begins is still in the car.
  const inCar =
    gameState !== undefined
      ? playerIdx >= 0 && lmuInCar(gameState)
      : !dataFrozen &&
        playerIdx >= 0 &&
        (raw.inRealtime || (raw.ignitionStarter ?? 0) > 0);
  t.IsOnTrack = bool('IsOnTrack', inCar);
  // In the car, the sim's word stands over a frozen block: a pause stops the
  // writes and ends nothing. Out of any session, the frame describes nothing.
  // At the monitor the freeze watch still decides whether the frame is
  // current. Where the player is comes from LmuOutOfCar below.
  t.LmuDataStale = bool(
    'LmuDataStale',
    gameState === undefined
      ? (dataFrozen ?? false)
      : !lmuInCar(gameState) &&
          (!lmuInSession(gameState) || (dataFrozen ?? false))
  );
  // Only the sim's own word, not an inference: this hides widgets, and a
  // guess from a frozen block is not enough to do that on. Outside a game is
  // further out of a session still.
  t.LmuNotInSession = bool(
    'LmuNotInSession',
    gameState === 'notInSession' || gameState === 'notInGame'
  );
  // The sim's word that the player is not in the car. IsOnTrack already says
  // so, but the driving gate ORs in the pit flags, and a car left in the pit
  // lane or stall keeps those set, live, while the player sits at the monitor.
  // Falsifying the pit flags instead would misreport the car to everything
  // else that reads them.
  t.LmuOutOfCar = bool(
    'LmuOutOfCar',
    gameState !== undefined && !lmuInCar(gameState)
  );
  // Reported as the snapshot has them, frozen or not. Falsifying these while
  // frozen was a mistake: isDriving reads them as `!isInGarage`, so clearing
  // them removed the one term that would have excluded a parked player.
  // LmuDataStale above is what consumers should gate on.
  t.IsInGarage = bool(
    'IsInGarage',
    playerIdx >= 0 && raw.vehInGarageStall[playerIdx]
  );
  t.IsGarageVisible = bool(
    'IsGarageVisible',
    playerIdx >= 0 && raw.vehInGarageStall[playerIdx]
  );

  // Defaults for everything not meaningful in LMU (pit service, radios, FFB,
  // tyre models, dash controls...). Kept long but explicit so the shape stays
  // stable if slots get consumed later.
  t.RadioTransmitCarIdx = num('RadioTransmitCarIdx', -1);
  t.RadioTransmitRadioIdx = num('RadioTransmitRadioIdx', 0);
  t.RadioTransmitFrequencyIdx = num('RadioTransmitFrequencyIdx', 0);
  t.PushToTalk = bool('PushToTalk', false);
  t.PushToPass = bool('PushToPass', false);
  t.PitOptRepairLeft = num('PitOptRepairLeft', 0);
  t.PitRepairLeft = num('PitRepairLeft', 0);
  t.PlayerIncidents = num('PlayerIncidents', 0);
  t.FastRepairUsed = num('FastRepairUsed', 0);
  t.FastRepairAvailable = num('FastRepairAvailable', 0);
  t.TireSetsUsed = num('TireSetsUsed', 0);
  t.TireSetsAvailable = num('TireSetsAvailable', 0);

  return t as unknown as Telemetry;
}
