import {
  CarLeftRight,
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
import { estimateLmuLapDistPct, type LmuLapDistanceState } from './lapDistance';
import {
  refineLmuOpponentLapDistPcts,
  type LmuOpponentLapDistanceState,
} from './opponentLapDistance';
import type { LmuRestCell, LmuRestCells } from './rest/state';
import { isLmuRaceSession } from './mapSession';
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

const num = (v: number | undefined) => ({ value: [v ?? 0] });
const bool = (v: boolean | number | undefined) => ({ value: [Boolean(v)] });
const numArr = (v: ArrayLike<number> | undefined) => ({
  value: v ? Array.from(v) : [],
});
const boolArr = (
  v: ArrayLike<number> | undefined,
  get: (n: number) => boolean
) => ({
  value: v ? Array.from(v, get) : [],
});
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
const lapTimeArr = (v: ArrayLike<number> | undefined) => ({
  value: v ? Array.from(v, lapTimeOrAbsent) : [],
});

/** A lap time for a single car, under the same rule. */
const lapTime = (v: number | undefined) => num(lapTimeOrAbsent(v));

/**
 * Per-car values where 0 is a legitimate reading, so only an empty slot may
 * become the sentinel.
 *
 * A car on its first lap genuinely has 0 completed laps, and createStandings
 * normalises a falsy lap count to 1; turning that 0 into -1 would corrupt the
 * lap-gap arithmetic for a real car.
 */
const occupiedArr = (
  v: ArrayLike<number> | undefined,
  raw: Raw,
  absent: number
) => ({
  value: v
    ? Array.from(v, (value, carIdx) =>
        isOccupied(raw, carIdx) ? value : absent
      )
    : [],
});

const lapDistPctArr = (v: ArrayLike<number> | undefined) => ({
  value: v
    ? Array.from(v, (value) =>
        value < 0 ? -1 : Math.min(1, Math.max(0, value))
      )
    : [],
});

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
    (raw.yellowFlagState >= 1 && raw.yellowFlagState <= 6) ||
    Array.from(raw.sectorFlags).some((flag) => flag === 1)
  ) {
    return GlobalFlags.Yellow;
  }
  const playerFlag = raw.vehFlag?.[raw.playerVehicleIdx];
  if (playerFlag === 6) return GlobalFlags.Blue;
  return 0;
}

function carSessionFlags(raw: Raw): number[] {
  return Array.from(raw.vehIds, (_, carIdx) => {
    let flags = 0;
    if (raw.vehFlag?.[carIdx] === 6) flags |= GlobalFlags.Blue;
    if (raw.vehUnderYellow?.[carIdx] === 1) flags |= GlobalFlags.Yellow;
    if (raw.vehFinishStatus?.[carIdx] === 3) flags |= GlobalFlags.Disqualify;
    return flags;
  });
}

const validTime = (value: number | undefined): number | null =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : null;

export function mapLmuSectorTimes(
  sector1: number | undefined,
  sector1And2: number | undefined,
  lapTime?: number
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
  return [first, second, third];
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
  restCells?: LmuRestCells
): Telemetry {
  // Boundary note: a handful of generated Telemetry keys (e.g. SessionTime) are
  // typed with an `undefined[]` value shape although the iRacing native layer
  // emits numbers there at runtime. Building into a plain record and casting is
  // the same boundary trick; values match iRacing's observable behaviour.
  const t: Record<string, { value: unknown[] }> = {};

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
          speedMs: raw.speed ?? 0,
          trackLengthM: raw.lapDist ?? 0,
        })
      : scoringLapDistPct;
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

  // Session-level
  // Both clocks come from the player's mElapsedTime, measured at 100 Hz,
  // rather than scoring's mCurrentET at 5 Hz. They are the same quantity --
  // seconds since the session began -- but LapTrace timestamps every sample
  // with SessionTime, so the 5 Hz one gave a fine distance axis against a
  // 200 ms staircase in time. It also gates ProcessorHost.isDue, which cannot
  // throttle on a clock that stands still.
  //
  // mElapsedTime is absent with no player car (spectating, garage), hence the
  // fallback.
  const sessionClock =
    typeof raw.elapsedTime === 'number' && raw.elapsedTime >= 0
      ? raw.elapsedTime
      : raw.currentET;
  t.SessionTick = num(sessionClock);
  t.SessionNum = num(raw.session);
  t.SessionUniqueID = num(raw.session);
  t.SessionState = num(PHASE_TO_SESSION_STATE[raw.gamePhase] ?? 0);
  t.SessionTime = num(sessionClock);
  t.SessionTimeRemain = num(raw.sessionTimeRemaining);
  t.SessionTimeTotal = num(raw.endET);
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
  t.SessionLapsRemain = num(
    hasLapLimit
      ? Math.max(
          0,
          raw.maxLaps -
            (playerIdx >= 0 ? (raw.vehTotalLaps[playerIdx] ?? 0) : 0)
        )
      : TIMED_SESSION_LAPS
  );
  t.SessionLapsTotal = num(hasLapLimit ? raw.maxLaps : TIMED_SESSION_LAPS);
  t.SessionTimeOfDay = num(raw.timeOfDay);
  t.SessionFlags = num(sessionFlags(raw));
  // Metric. iRacing carries the driver's own unit preference here and widgets
  // resolve 'auto' from it; LMU's shared memory has no equivalent, and 0
  // (imperial) meant every 'auto' widget showed mph for a sim whose own UI,
  // pit limits and timing are all metric.
  t.DisplayUnits = num(1);
  t.IsReplayPlaying = bool(false);
  t.ReplayFrameNum = num(0);
  t.ReplayFrameNumEnd = num(0);

  // Player
  t.PlayerCarIdx = num(playerIdx);
  t.PlayerCarMyIncidentCount = num(0);
  t.PlayerCarTeamIncidentCount = num(0);
  t.PlayerCarTowTime = num(0);
  t.PlayerCarInPitStall = bool(
    playerIdx >= 0 &&
      (raw.vehInGarageStall[playerIdx] || raw.vehPitState[playerIdx] === 3)
  );
  t.PlayerTireCompound = num(0);
  t.PlayerFastRepairsUsed = num(0);
  t.PlayerTrackSurface = num(
    playerIdx >= 0 ? trackLocation(raw, playerIdx) : TRACK_NOT_IN_WORLD
  );
  t.PlayerCarPosition = num(raw.vehPlaces[playerIdx] ?? 0);
  t.PlayerCarClass = num(raw.vehClass[playerIdx] ?? 0);
  t.CamCarIdx = num(playerIdx);
  t.PlayerCarPitSvStatus = num(0);
  t.CarLeftRight = num(blindSpot?.state ?? CarLeftRight.Off);

  // Per-car
  t.CarIdxLap = occupiedArr(raw.vehTotalLaps, raw, -1);
  t.CarIdxLapCompleted = occupiedArr(raw.vehTotalLaps, raw, -1);
  t.CarIdxLapDistPct = lapDistPctArr(raw.vehLapDistPct);
  // The player's own slot takes the smoothed value too, so anything measuring
  // against the player sees continuous motion rather than a 5 Hz step.
  const carIdxLapDistPct = t.CarIdxLapDistPct.value as number[];
  if (
    playerIdx >= 0 &&
    playerIdx < carIdxLapDistPct.length &&
    estimatedLapDistPct >= 0
  ) {
    carIdxLapDistPct[playerIdx] = lapDistPct;
  }
  // And every other car, from the same 100 Hz telemetry block. Without this
  // they sit at the 5 Hz scoring rate -- ~14 m steps on a long circuit -- and
  // CarSpeedsProcessor differentiates those steps into opponent speed, which
  // the slow-car and faster-car warnings then threshold on.
  if (opponentLapDistanceState) {
    refineLmuOpponentLapDistPcts(opponentLapDistanceState, carIdxLapDistPct, {
      scoringPcts: raw.vehLapDistPct,
      speeds: raw.vehSpeed,
      lapNumbers: raw.vehLapNumber,
      elapsedTimes: raw.vehElapsedTime,
      telemetryAvailable: raw.vehTelemetryAvailable,
      trackLengthM: raw.lapDist,
      playerCarIdx: playerIdx,
    });
  }
  t.CarIdxTrackSurface = {
    value: Array.from(raw.vehInPits, (_, carIdx) => trackLocation(raw, carIdx)),
  };
  t.CarIdxOnPitRoad = boolArr(raw.vehInPits, (v) => v === 1);
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
  t.CarIdxClassPosition = numArr(classPositionState.positions);
  // Outright position. A race takes the sim's own mPlace, which already
  // accounts for laps and sector order; practice and qualifying take the
  // best-lap ordering above, because LMU leaves mPlace at entry order there --
  // and the standings sort their rows on this, so a correct class column was
  // still being rendered in car-number order.
  t.CarIdxPosition = numArr(
    isLmuRaceSession(raw.session) ? raw.vehPlaces : classPositionState.overall
  );
  t.CarIdxClass = occupiedArr(raw.vehClass, raw, -1);
  t.CarIdxF2Time = numArr(raw.vehTimeBehindLeader);
  t.CarIdxEstTime = numArr(raw.vehTimeIntoLap);
  t.CarIdxLastLapTime = lapTimeArr(raw.vehLastLapTime);
  t.CarIdxBestLapTime = lapTimeArr(raw.vehBestLapTime);
  t.CarIdxGear = numArr(undefined);
  t.CarIdxTireCompound = numArr(undefined);
  t.CarIdxSessionFlags = numArr(carSessionFlags(raw));
  t.CarDistAhead = numArr(undefined);
  t.CarDistBehind = numArr(undefined);
  t.LmuCarIdxRelativeAvailable = {
    value: relativePositions?.available ?? [],
  };
  t.LmuCarIdxRelativeLateral = numArr(relativePositions?.lateral);
  t.LmuCarIdxRelativeLongitudinal = numArr(relativePositions?.longitudinal);
  t.LmuCarIdxRelativeHeading = numArr(relativePositions?.heading);
  // Fore(+)/aft(-) metres of the nearest car each side, straight from the
  // 100 Hz world positions. A display of the car's position alongside reads
  // this instead of subtracting lap-distance percentages, which the 5 Hz
  // scoring block quantises far more coarsely than such a display spans.
  t.LmuBlindSpotLeftLongitudinal = {
    value: [blindSpot?.leftLongitudinalM ?? null],
  };
  t.LmuBlindSpotRightLongitudinal = {
    value: [blindSpot?.rightLongitudinalM ?? null],
  };

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

  // Shared memory, unlike the cells above. The addon always writes these when
  // LMU is running, so the guard is only for a tape or a build predating the
  // export -- not for a car without a hybrid system, which reports 0. A
  // consumer wanting "does this car use virtual energy?" should ask the pit
  // menu via LmuRefuelTargetIsVirtualEnergy, not infer it from a 0 here.
  if (raw.virtualEnergy !== undefined) {
    t.LmuVirtualEnergy = num(raw.virtualEnergy);
  }
  if (raw.stateOfCharge !== undefined) {
    t.LmuStateOfCharge = num(raw.stateOfCharge);
  }
  if (raw.regen !== undefined) t.LmuRegen = num(raw.regen);

  // LMU reports steering as a fraction of the full wheel range; iRacing uses radians.
  t.SteeringWheelAngle = num(-(raw.filteredSteering ?? 0) * steeringMaxRad);
  t.Throttle = num(raw.filteredThrottle);
  t.Brake = num(raw.filteredBrake);
  t.Clutch = num(
    raw.filteredClutch === undefined ? undefined : 1 - raw.filteredClutch
  );
  t.Gear = num(raw.gear);
  t.RPM = num(raw.engineRPM);
  t.Lap = num(raw.lapNumber);
  t.LapCompleted = num(raw.vehTotalLaps[playerIdx] ?? 0);
  t.LapDistPct = num(lapDistPct);
  t.LapBestLapTime = lapTime(raw.vehBestLapTime[playerIdx]);
  t.LapLastLapTime = lapTime(raw.vehLastLapTime[playerIdx]);
  t.LapCurrentLapTime = num(
    Math.max(0, (raw.elapsedTime ?? 0) - (raw.lapStartET ?? 0))
  );
  t.LmuCurrentSectorTimes = {
    value: mapLmuSectorTimes(
      raw.vehCurSector1?.[playerIdx],
      raw.vehCurSector2?.[playerIdx]
    ),
  };
  t.LmuLastSectorTimes = {
    value: mapLmuSectorTimes(
      raw.vehLastSector1?.[playerIdx],
      raw.vehLastSector2?.[playerIdx],
      raw.vehLastLapTime?.[playerIdx]
    ),
  };
  t.LmuBestSectorTimes = {
    value: mapLmuSectorTimes(
      raw.vehBestSector1?.[playerIdx],
      raw.vehBestSector2?.[playerIdx],
      raw.vehBestLapTime?.[playerIdx]
    ),
  };
  t.LmuSectorIdx = num(sectorIdx(raw.vehSector?.[playerIdx]));
  t.Speed = num(raw.speed);
  t.Yaw = num(0);
  t.YawNorth = num(0);
  t.Pitch = num(0);
  t.Roll = num(0);
  t.SteeringWheelAngleMax = num(steeringMaxRad);
  if (raw.localAccel) {
    t.LatAccel = num(raw.localAccel[0]);
    t.LongAccel = num(raw.localAccel[2]);
  }

  const corners = ['LF', 'RF', 'LR', 'RR'] as const;
  corners.forEach((corner, index) => {
    const temperature = raw.tyreTemperature?.[index];
    if (temperature !== undefined) {
      t[`${corner}tempCL`] = num(temperature);
      t[`${corner}tempCM`] = num(temperature);
      t[`${corner}tempCR`] = num(temperature);
    }
    const pressure = raw.tyrePressure?.[index];
    if (pressure !== undefined) t[`${corner}coldPressure`] = num(pressure);
    const wear = raw.tyreWear?.[index];
    if (wear !== undefined) {
      t[`${corner}wearL`] = num(wear);
      t[`${corner}wearM`] = num(wear);
      t[`${corner}wearR`] = num(wear);
    }
    const brakePressure = raw.brakePressure?.[index];
    if (brakePressure !== undefined) {
      t[`${corner}brakeLinePress`] = num(brakePressure);
    }
    const deflection = raw.suspensionDeflection?.[index];
    if (deflection !== undefined) t[`${corner}shockDefl`] = num(deflection);
  });

  // Environment
  t.TrackTemp = num(raw.trackTemp);
  t.TrackTempCrew = num(raw.trackTemp);
  t.AirTemp = num(raw.ambientTemp);
  t.TrackWetness = num(raw.avgPathWetness);
  t.Skies = num(raw.cloudCoverage);
  t.WindVel = num(
    Math.hypot(raw.wind[0] ?? 0, raw.wind[1] ?? 0, raw.wind[2] ?? 0)
  );
  t.WindDir = num(0);
  t.RelativeHumidity = num(0);
  t.FogLevel = num(0);
  t.Precipitation = num(raw.raining);
  t.WeatherDeclaredWet = bool(raw.raining > 0);

  // Car condition
  t.WaterTemp = num(raw.engineWaterTemp);
  t.OilTemp = num(raw.engineOilTemp);
  t.FuelLevel = num(raw.fuel);
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
    raw.fuelCapacity && raw.fuel !== undefined ? raw.fuel / raw.fuelCapacity : 0
  );
  t.EngineWarnings = num(0);
  t.ShiftGrindRPM = num(raw.engineMaxRPM ?? 0);
  t.ThrottleRaw = num(raw.unfilteredThrottle);
  t.BrakeRaw = num(raw.unfilteredBrake);
  t.ClutchRaw = num(
    raw.unfilteredClutch === undefined ? undefined : 1 - raw.unfilteredClutch
  );
  t.BrakeABSactive = bool(raw.absActive);
  // Percent front, which is what dcBrakeBias means and what the widget
  // formats with a '%' unit. LMU publishes only mRearBrakeBias, as a 0-1
  // fraction -- there is no mFrontBrakeBias, front is its complement -- so the
  // complement alone gave 0.508 where 50.8 was wanted, and the widget showed a
  // bias of "0.5%" that barely moved as it was adjusted.
  t.dcBrakeBias = num(
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
  const dial = (key: string, value?: number, max?: number) => {
    if ((max ?? 0) > 0) t[key] = num(value);
  };
  dial('dcABS', raw.abs, raw.absMax);
  dial('dcEnginePower', raw.motorMap, raw.motorMapMax);
  dial('dcAntiRollFront', raw.frontAntiSway, raw.frontAntiSwayMax);
  dial('dcAntiRollRear', raw.rearAntiSway, raw.rearAntiSwayMax);

  // Three traction dials into the catalogue's two generic traction slots.
  //
  // LMU splits traction control into an overall level, a slip target and a
  // throttle cut, and which of them a car actually offers varies -- a GT3 has
  // the level alone, a Hypercar the slip and cut pair. iRacing's catalogue has
  // Traction Control and Traction Control 2, named generically because the
  // channel means whatever the car wires to it, so the dials the car has are
  // filled in in order rather than each being pinned to a fixed slot. A car
  // with only slip and cut would otherwise leave the TC column blank and show
  // its first dial under TC2.
  //
  // The maxes are fixed per car and a car change resets the processor, so a
  // column cannot change meaning underneath a driver mid-session.
  let tcSlot = 0;
  const tcDial = (value?: number, max?: number) => {
    if ((max ?? 0) <= 0 || tcSlot > 1) return;
    t[tcSlot === 0 ? 'dcTractionControl' : 'dcTractionControl2'] = num(value);
    tcSlot += 1;
  };
  tcDial(raw.tc, raw.tcMax);
  tcDial(raw.tcSlip, raw.tcSlipMax);
  tcDial(raw.tcCut, raw.tcCutMax);
  t.dcPitSpeedLimiterToggle = bool(raw.speedLimiter);
  t.PitstopActive = bool(false);
  t.OnPitRoad = bool(playerIdx >= 0 ? raw.vehInPits[playerIdx] === 1 : false);
  t.IsOnTrack = bool(playerIdx >= 0 && raw.inRealtime);
  t.IsInGarage = bool(playerIdx >= 0 && raw.vehInGarageStall[playerIdx]);
  t.IsGarageVisible = bool(playerIdx >= 0 && raw.vehInGarageStall[playerIdx]);

  // Defaults for everything not meaningful in LMU (pit service, radios, FFB,
  // tyre models, dash controls...). Kept long but explicit so the shape stays
  // stable if slots get consumed later.
  t.RadioTransmitCarIdx = num(-1);
  t.RadioTransmitRadioIdx = num(0);
  t.RadioTransmitFrequencyIdx = num(0);
  t.PushToTalk = bool(false);
  t.PushToPass = bool(false);
  t.PitOptRepairLeft = num(0);
  t.PitRepairLeft = num(0);
  t.PlayerIncidents = num(0);
  t.FastRepairUsed = num(0);
  t.FastRepairAvailable = num(0);
  t.TireSetsUsed = num(0);
  t.TireSetsAvailable = num(0);

  return t as unknown as Telemetry;
}
