/** Raw shapes returned by the LMU shared-memory addon (see lmu_node.cc). */

export type LmuVec = number[];

export interface LmuRawVehicle {
  id: number;
  isPlayer: boolean;
  /** LMU mControl: 0 local player, 1 local AI, 2 remote, 3 replay. */
  control?: number;
  name: string;
  vehicleName: string;
  vehicleModel?: string;
  /**
   * The fitted compound's name and index, front and rear.
   *
   * Both halves of the same fact, which is why they are together: the index is
   * what the per-wheel telemetry reports, and the name is the only thing that
   * says what an index means. Absent for a car with no telemetry block.
   */
  frontTireCompoundName?: string;
  rearTireCompoundName?: string;
  frontTireCompoundIndex?: number;
  rearTireCompoundIndex?: number;
  className: string;
  vehFilename: string;
  classId: number;
  totalLaps: number;
  sector: number;
  finishStatus: number;
  lapDist: number;
  bestSector1: number;
  bestSector2: number;
  bestLapTime: number;
  lastSector1: number;
  lastSector2: number;
  lastLapTime: number;
  numPitstops: number;
  numPenalties: number;
  inPits: boolean;
  place: number;
  timeBehindNext: number;
  lapsBehindNext: number;
  timeBehindLeader: number;
  lapsBehindLeader: number;
  qualification: number;
  timeIntoLap: number;
  estimatedLapTime: number;
  pitState: number;
  individualPhase: number;
  underYellow: boolean;
  countLapFlag: number;
  inGarageStall: boolean;
  pitLapDist: number;
  /**
   * Steam64 id as a decimal string.
   *
   * Not a number: the value exceeds the 2^53 range JS integers are exact
   * in, so a numeric form loses its last digits and no longer identifies
   * the player.
   */
  steamId: string;
  /**
   * Raw mFuelFraction, straight off a uint8_t, so always a whole number.
   *
   * The scale is the byte: divide by 255 for a fraction. Neither 0..1 nor a
   * percentage, which an earlier note here guessed at -- the same quantisation
   * the sim uses for mLiftAndCoastProgress.
   *
   * Per car and on the session snapshot, which only rebuilds when the session
   * signature moves, so this is not a live reading. The telemetry channel
   * LmuCarIdxEnergyRemaining is, and is what consumers should use.
   */
  fuelFraction: number;
  pos: LmuVec;
  localVel: LmuVec;
}

export interface LmuRawTelemetry {
  running: boolean;
  gameVersion: number;
  trackName: string;
  playerName: string;
  serverName: string;
  session: number;
  currentET: number;
  endET: number;
  maxLaps: number;
  lapDist: number;
  numVehicles: number;
  gamePhase: number;
  yellowFlagState: number;
  sectorFlags: Uint8Array;
  inRealtime: boolean;
  gameMode: number;
  isFixedSetup: boolean;
  maxPlayers: number;
  sessionTimeRemaining: number;
  timeOfDay: number;
  /**
   * The sim's session callbacks, as monotonic counters.
   *
   * LMU calls EndSession when a session finishes and StartSession when one
   * begins, and bumps these. An increment is the only unambiguous statement
   * that a session boundary happened -- the clock freezing or the grid
   * emptying are both inferences.
   */
  sessionStartEvents: number;
  sessionEndEvents: number;
  /** Scoring's write counter. Stalls when the session stops being scored. */
  scoringUpdates: number;
  trackGripLevel: number;
  /**
   * The scale of LMU's track-limits penalty system.
   *
   * `mTrackLimitsSteps` on a car is counted in steps, not points:
   * `steps / trackLimitsStepsPerPoint` is the points figure the sim displays,
   * and `trackLimitsStepsPerPenalty / trackLimitsStepsPerPoint` is the ceiling
   * a drive-through is served at. Neither number means anything alone.
   */
  trackLimitsStepsPerPoint: number;
  trackLimitsStepsPerPenalty: number;
  cloudCoverage: number;
  raining: number;
  darkCloud: number;
  ambientTemp: number;
  trackTemp: number;
  minPathWetness: number;
  maxPathWetness: number;
  avgPathWetness: number;
  wind: LmuVec;
  playerVehicleIdx: number;
  playerHasVehicle: boolean;
  activeVehicles: number;
  // Present only when playerHasVehicle
  gear?: number;
  engineRPM?: number;
  engineWaterTemp?: number;
  engineOilTemp?: number;
  clutchRPM?: number;
  unfilteredThrottle?: number;
  unfilteredBrake?: number;
  unfilteredSteering?: number;
  unfilteredClutch?: number;
  filteredThrottle?: number;
  filteredBrake?: number;
  filteredSteering?: number;
  filteredClutch?: number;
  steeringShaftTorque?: number;
  fuel?: number;
  fuelCapacity?: number;
  /** Virtual energy remaining. A fraction of the REST maxVirtualEnergy. */
  virtualEnergy?: number;
  /** Hybrid state of charge. */
  stateOfCharge?: number;
  /** Hybrid regeneration. */
  regen?: number;
  engineMaxRPM?: number;
  rearBrakeBias?: number;
  lapNumber?: number;
  elapsedTime?: number;
  lapStartET?: number;
  currentSector?: number;
  lapInvalidated?: boolean;
  speedLimiterActive?: boolean;
  speedLimiter?: number;
  absActive?: boolean;
  tcActive?: boolean;
  /**
   * Driver-adjustable dials, each with the top of its own scale.
   *
   * The max is how a car says it has the control at all: a car without the
   * dial reports 0 for both. A setting whose max is 0 is not published as a
   * channel, so the Car Systems widget shows a row only for a control the
   * car really has.
   */
  abs?: number;
  absMax?: number;
  tc?: number;
  tcMax?: number;
  tcSlip?: number;
  tcSlipMax?: number;
  tcCut?: number;
  tcCutMax?: number;
  /** Engine map. */
  motorMap?: number;
  motorMapMax?: number;
  /** Brake migration. */
  migration?: number;
  migrationMax?: number;
  frontAntiSway?: number;
  frontAntiSwayMax?: number;
  rearAntiSway?: number;
  rearAntiSwayMax?: number;
  ignitionStarter?: number;
  maxGears?: number;
  visualSteeringWheelRange?: number;
  deltaBest?: number;
  batteryChargeFraction?: number;
  turboBoostPressure?: number;
  frontTireCompoundName?: string;
  vehicleName?: string;
  speed?: number;
  localVel?: LmuVec;
  localAccel?: LmuVec;
  pos?: LmuVec;
  tyreTemperature?: Float64Array;
  tyrePressure?: Float64Array;
  tyreWear?: Float64Array;
  brakePressure?: Float64Array;
  suspensionDeflection?: Float64Array;
  // Per-vehicle arrays, indexed by CarIdx (vehicle slot id)
  vehIds: Int32Array;
  vehIsPlayer: Uint8Array;
  vehPlaces: Int32Array;
  vehLapDistPct: Float64Array;
  vehTotalLaps: Int32Array;
  vehBestLapTime: Float64Array;
  vehLastLapTime: Float64Array;
  vehInPits: Uint8Array;
  vehInGarageStall: Uint8Array;
  vehPitState: Uint8Array;
  vehClass: Int32Array;
  vehTimeIntoLap: Float64Array;
  vehEstimatedLapTime: Float64Array;
  vehTimeBehindNext: Float64Array;
  vehTimeBehindLeader: Float64Array;
  vehLapsBehindNext: Int32Array;
  vehLapsBehindLeader: Int32Array;
  vehQualification: Float64Array;
  vehFinishStatus: Int32Array;
  vehIndividualPhase: Int32Array;
  vehLapStartET: Float64Array;
  vehSector: Int32Array;
  vehFlag: Uint8Array;
  vehUnderYellow: Uint8Array;
  vehBestSector1: Float64Array;
  vehBestSector2: Float64Array;
  vehLastSector1: Float64Array;
  vehLastSector2: Float64Array;
  vehCurSector1: Float64Array;
  vehCurSector2: Float64Array;
  vehTelemetryAvailable: Uint8Array;
  vehPosX: Float64Array;
  vehPosZ: Float64Array;
  vehOriX: Float64Array;
  vehOriZ: Float64Array;
  /** 100 Hz speed magnitude per car, m/s, from the telemetry block. */
  vehSpeed?: ArrayLike<number>;
  /** 100 Hz lap number per car. */
  vehLapNumber?: ArrayLike<number>;
  /** 100 Hz per-car telemetry clock, seconds. */
  vehElapsedTime?: ArrayLike<number>;
  /**
   * Compound index per wheel, per car: four entries per slot at
   * `id * 4 + wheel`, in the sim's wheel order (FL, FR, RL, RR).
   *
   * -1 where the car had no telemetry block that frame. 0 is a real compound,
   * so the sentinel cannot be 0.
   */
  vehWheelCompounds?: ArrayLike<number>;
  /**
   * Track-limit infringement steps per car, indexed by slot.
   *
   * -1 where the car had no telemetry block that frame. 0 is a clean car, so
   * the sentinel cannot be 0. Divide by `trackLimitsStepsPerPoint` for the
   * points figure.
   */
  vehTrackLimitsSteps?: ArrayLike<number>;
  /**
   * Fuel remaining per car, as the sim quantises it: a byte over 255, not a
   * percentage. From scoring, so every car on the grid has one.
   */
  /**
   * Outstanding penalties per car, from scoring's mNumPenalties.
   *
   * A count. Scoring carries no field for which penalty it is -- that comes
   * from the pit-stop estimate's penalty time, and only for the player. See
   * lmu/penalty.ts.
   */
  vehNumPenalties?: ArrayLike<number>;
  vehFuelFraction?: ArrayLike<number>;
  /**
   * Virtual energy remaining per car, already a fraction.
   *
   * From the telemetry block, so -1 where a car reported none this frame. 0 is
   * an empty battery, not a missing reading, which is why the sentinel is -1.
   */
  vehVirtualEnergy?: ArrayLike<number>;
}

export interface LmuRawSession extends LmuRawTelemetry {
  classes: { id: number; name: string }[];
  drivers: LmuRawVehicle[];
}

export class NativeLmu {
  constructor();
  start(): boolean;
  stop(): boolean;
  isRunning(): boolean;
  read(): LmuRawTelemetry;
  readSession(): LmuRawSession;
  /**
   * The latest recorded REST body for a path, or null.
   *
   * Only the replay build has anything: the live build reads LMU's REST API
   * over HTTP from the JS side and returns null for everything here.
   */
  readRest(path: string): string | null;
}
