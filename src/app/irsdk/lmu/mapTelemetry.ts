import {
  CarLeftRight,
  GlobalFlags,
  SessionState,
  type Telemetry,
} from '@irdashies/types';
import { classifyLmuBlindSpot, deriveLmuRelativePositions } from './proximity';

type Raw = import('../native/lmu').LmuRawTelemetry;

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
const lapDistPctArr = (v: ArrayLike<number> | undefined) => ({
  value: v
    ? Array.from(v, (value) =>
        value < 0 ? -1 : Math.min(1, Math.max(0, value))
      )
    : [],
});

export function mapLmuCarLeftRight(raw: Raw): CarLeftRight | null {
  return classifyLmuBlindSpot(deriveLmuRelativePositions(raw));
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
export function mapLmuTelemetry(raw: Raw): Telemetry {
  // Boundary note: a handful of generated Telemetry keys (e.g. SessionTime) are
  // typed with an `undefined[]` value shape although the iRacing native layer
  // emits numbers there at runtime. Building into a plain record and casting is
  // the same boundary trick; values match iRacing's observable behaviour.
  const t: Record<string, { value: unknown[] }> = {};

  const playerIdx =
    raw.playerHasVehicle && raw.playerVehicleIdx >= 0
      ? raw.playerVehicleIdx
      : -1;
  const lapDistPct = Math.min(
    1,
    Math.max(0, raw.vehLapDistPct[playerIdx] ?? 0)
  );
  const steeringMaxRad = ((raw.visualSteeringWheelRange ?? 0) * Math.PI) / 360;
  const relativePositions = deriveLmuRelativePositions(raw);

  // Session-level
  t.SessionTick = num(raw.currentET);
  t.SessionNum = num(raw.session);
  t.SessionUniqueID = num(raw.session);
  t.SessionState = num(PHASE_TO_SESSION_STATE[raw.gamePhase] ?? 0);
  t.SessionTime = num(raw.currentET);
  t.SessionTimeRemain = num(raw.sessionTimeRemaining);
  t.SessionTimeTotal = num(raw.endET);
  t.SessionLapsRemain = num(
    raw.maxLaps > 0
      ? Math.max(
          0,
          raw.maxLaps -
            (playerIdx >= 0 ? (raw.vehTotalLaps[playerIdx] ?? 0) : 0)
        )
      : 0
  );
  t.SessionLapsTotal = num(raw.maxLaps);
  t.SessionTimeOfDay = num(raw.timeOfDay);
  t.SessionFlags = num(sessionFlags(raw));
  t.DisplayUnits = num(0);
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
    playerIdx >= 0 ? trackLocation(raw, playerIdx) : TRACK_ON_TRACK
  );
  t.PlayerCarPosition = num(raw.vehPlaces[playerIdx] ?? 0);
  t.PlayerCarClass = num(raw.vehClass[playerIdx] ?? 0);
  t.CamCarIdx = num(playerIdx);
  t.PlayerCarPitSvStatus = num(0);
  t.CarLeftRight = num(mapLmuCarLeftRight(raw) ?? CarLeftRight.Off);

  // Per-car
  t.CarIdxLap = numArr(raw.vehTotalLaps);
  t.CarIdxLapCompleted = numArr(raw.vehTotalLaps);
  t.CarIdxLapDistPct = lapDistPctArr(raw.vehLapDistPct);
  t.CarIdxTrackSurface = {
    value: Array.from(raw.vehInPits, (_, carIdx) => trackLocation(raw, carIdx)),
  };
  t.CarIdxOnPitRoad = boolArr(raw.vehInPits, (v) => v === 1);
  t.CarIdxPosition = numArr(raw.vehPlaces);
  t.CarIdxClassPosition = numArr(undefined);
  t.CarIdxClass = numArr(raw.vehClass);
  t.CarIdxF2Time = numArr(raw.vehTimeBehindLeader);
  t.CarIdxEstTime = numArr(raw.vehTimeIntoLap);
  t.CarIdxLastLapTime = numArr(raw.vehLastLapTime);
  t.CarIdxBestLapTime = numArr(raw.vehBestLapTime);
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
  t.LapBestLapTime = num(raw.vehBestLapTime[playerIdx] ?? 0);
  t.LapLastLapTime = num(raw.vehLastLapTime[playerIdx] ?? 0);
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
  t.dcBrakeBias = num(
    raw.rearBrakeBias === undefined ? 0 : 1 - raw.rearBrakeBias
  );
  t.dcPeakBrakeBias = num(
    raw.rearBrakeBias === undefined ? 0 : 1 - raw.rearBrakeBias
  );
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
