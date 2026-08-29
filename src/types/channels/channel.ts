import type { FuelLapData } from '../fuelCalculatorBridge';
import type { Incident } from '../raceControl';
import type { ReferenceLap } from '../referenceLaps';
import type { Sector } from '../session';

export type SessionLifecycleEvent =
  | { type: 'enter'; replay: boolean }
  | { type: 'sessionNumChange' }
  | { type: 'disconnect' };

export interface ChannelPayloads {
  'blind-spot.snapshot': BlindSpotSnapshot;
  'car-speeds.snapshot': CarSpeedsSnapshot;
  'driver-controls.snapshot': DriverControlsSnapshot;
  'fuel.projection': FuelProjectionSnapshot;
  'lap-times.snapshot': LapTimesSnapshot;
  'lap-log.snapshot': LapLogSnapshot;
  'lap-history.snapshot': LapHistorySnapshot;
  'reference-laps.snapshot': ReferenceLapsSnapshot;
  'radio.snapshot': RadioSnapshot;
  'relative-gaps.snapshot': RelativeGapsSnapshot;
  'sector-timing.snapshot': SectorTimingSnapshot;
  'session-timing.snapshot': SessionTimingSnapshot;
  'session-bar.snapshot': SessionBarSnapshot;
  'standings.snapshot': StandingsSnapshot;
  'track-state.snapshot': TrackStateSnapshot;
  'session.lifecycle': SessionLifecycleEvent;
  'raceControl.incidents': Incident;
  /**
   * Fires when the SubSessionID the incident store is keyed on changes; '' when
   * disconnected. The Gantry reloads its persisted incidents on each change.
   */
  'raceControl.sessionId': string;
}

export interface TrackStateSnapshot {
  focusCarIdx: number | null;
  carIdxLapDistPct: readonly number[];
  carIdxOnPitRoad: readonly boolean[];
  carIdxTrackSurface: readonly number[];
  carIdxClassPosition: readonly number[];
  carLeftRight: number;
  isOnTrack: boolean;
  playerCarInPitStall: boolean;
  playerTrackSurface: number;
  onPitRoad: boolean;
  isInGarage: boolean;
  isGarageVisible: boolean;
  isReplayPlaying: boolean;
  sessionTime: number;
  sessionState: number;
  sessionFlags: number;
  speed: number;
  displayUnits: number;
  pitSpeedLimiterToggle: boolean;
  pitstopActive: boolean;
  engineWarnings: number;
  lapDistPct: number;
  sessionNum: number | null;
  version: number;
}

export interface BlindSpotSnapshot {
  carLeftRight: number;
  carIdxLapDistPct: readonly number[];
  isOnTrack: boolean;
  version: number;
}

export interface DriverControlsSnapshot {
  brake?: number;
  brakeRaw?: number;
  throttle?: number;
  throttleRaw?: number;
  clutch?: number;
  clutchRaw?: number;
  gear?: number;
  speed?: number;
  displayUnits?: number;
  steeringWheelAngle?: number;
  brakeAbsActive?: boolean;
  rpm?: number;
  shiftGrindRpm?: number;
  oilTemp?: number;
  waterTemp?: number;
  engineWarnings?: number;
  shiftRpm?: number;
  blinkRpm?: number;
  version: number;
}

export interface SessionBarSnapshot {
  sessionName?: string;
  trackDisplayName?: string;
  displayUnits: number;
  brakeBias?: number;
  brakeBiasIsClio: boolean;
  incidents: number;
  incidentLimit?: number | string;
  incidentWarningInitialLimit?: number;
  incidentWarningSubsequentLimit?: number;
  trackWetness: number;
  precipitation?: number;
  relativeHumidity?: number;
  airTemp?: number;
  trackTemp?: number;
  windDirection?: number;
  windVelocity?: number;
  windYaw?: number;
  fuelLevel?: number;
  lastLapTime?: number;
  bestLapTime?: number;
  sessionBestLap?: number;
  sessionTimeOfDay?: number;
  playerCarIdx: number | null;
  playerCarId?: number;
  playerClassified: boolean;
  playerOverallPosition: number;
  playerClassPosition: number;
  playerClassSize: number;
  competitorCarIds: readonly number[];
  competitorPositions: readonly number[];
  lastLapTopSpeed: number | null;
  sessionBestTopSpeed: number | null;
  sessionNum: number | null;
  version: number;
}

export interface LapLogSnapshot {
  lapCompleted: number;
  currentLapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  carIdxBestLapTime: readonly number[];
  sessionNum: number | null;
  sessionTime: number;
  playerTrackSurface: number;
  incidentCount: number;
  lapDistPct: number;
  deltaToSessionLastLap: number;
  deltaToSessionLastLapOk: boolean;
  deltaToSessionBestLap: number;
  deltaToSessionBestLapOk: boolean;
  version: number;
}

/** Bit flags recorded against a single lap crossing. */
export const LAP_CROSSING_IN_PIT = 1 << 0;
export const LAP_CROSSING_OFF_TRACK = 1 << 1;
export const LAP_CROSSING_LAPPED = 1 << 2;

/** Crossings retained per car. Documented cap - see LapHistoryProcessor. */
export const LAP_HISTORY_CAPACITY = 300;

/**
 * Raw lap-crossing record for every car, from which the Gantry derives race
 * traces, true gaps and position-by-lap.
 *
 * Storage is flat and preallocated: field `f` for crossing `i` of car `c` is at
 * `f[c * capacity + (start[c] + i) % capacity]`, for `i` in `0..count[c] - 1`.
 * Plain arrays rather than typed arrays, because channel payloads are JSON
 * serialised on the web-server transport and typed arrays do not survive it.
 * Once `count[c]` reaches `capacity` the buffer becomes a ring and the oldest
 * crossing is dropped, so a long race shows a rolling window of recent laps.
 *
 * Nothing here is defaulted or absolute-valued. A pit lap is recorded with its
 * real crossing time and the in-pit flag set, rather than a fabricated gap.
 */
export interface LapHistorySnapshot {
  /** Number of car slots the buffers are sized for. */
  carCount: number;
  /** Crossings retained per car. */
  capacity: number;
  /** Valid crossings held for each car, indexed by CarIdx. */
  count: readonly number[];
  /** Ring offset of the oldest valid crossing for each car. */
  start: readonly number[];
  /** Lap just completed at the crossing. */
  lap: readonly number[];
  /** SessionTime at the crossing, in seconds. Absolute, never accumulated. */
  sessionTime: readonly number[];
  /** In-class position at the crossing. 0 when unknown. */
  classPosition: readonly number[];
  /** LAP_CROSSING_* bit flags. */
  flags: readonly number[];
  sessionNum: number | null;
  version: number;
}

export interface SessionTimingSnapshot {
  sessionType?: string;
  state: number;
  currentLap: number;
  totalLaps: number;
  time: number;
  timeTotal: number;
  timeRemaining: number;
  greenFlagTimestamp: number;
  isFixedLapRace: boolean;
  totalRaceLaps: number;
  totalRaceTime: number;
  adjustedRaceTime: number;
  sessionNum: number | null;
  version: number;
}

export interface RadioSnapshot {
  /** Cars transmitting on the current SDK frame, excluding the idle sentinel. */
  transmittingCarIdxs: readonly number[];
  version: number;
}

export interface StandingsSnapshot {
  focusCarIdx: number | null;
  sessionNum: number | null;
  carIdxF2Time: number[];
  carIdxPosition: number[];
  carIdxClassPosition: number[];
  carIdxBestLapTime: number[];
  carIdxLastLapTime: number[];
  carIdxEstTime: number[];
  carIdxOnPitRoad: boolean[];
  carIdxLap: number[];
  carIdxLapDistPct: number[];
  carIdxTrackSurface: number[];
  carIdxTireCompound: number[];
  carIdxSessionFlags: number[];
  carIdxP2PStatus: boolean[];
  carIdxP2PCount: number[];
  sessionUniqueId: number;
  sessionTime: number;
  sessionState: number;
  lastPitLap: (number | undefined)[];
  previousCarTrackSurface: (number | undefined)[];
  /** Current calculated in-class position, indexed by CarIdx. */
  liveClassPosition: (number | undefined)[];
  version: number;
}

export interface SectorTimingResultSnapshot {
  currentLapSectorTimes: readonly (number | null)[];
  previousLapSectorTimes: readonly (number | null)[];
  currentLapSectorUnclean: readonly boolean[];
  previousLapSectorUnclean: readonly boolean[];
  sessionBestSectorTimes: readonly (number | null)[];
  previousSessionBestSectorTimes: readonly (number | null)[];
}

export interface SectorTimingSnapshot {
  sectors: readonly Sector[];
  currentSectorIdx: number;
  sectorEntryTime: number;
  sectorEntryValid: boolean;
  /** Timing view which includes sectors completed after leaving the track. */
  inclusive: SectorTimingResultSnapshot;
  /** Timing view which ignores sectors completed after leaving the track. */
  clean: SectorTimingResultSnapshot;
  sessionNum: number | null;
  version: number;
}

export interface RelativeGapsSnapshot {
  /** Car currently centred by relative displays. */
  focusCarIdx: number | null;
  /** Signed wrapped track distance from the focus car, indexed by CarIdx. */
  relativePcts: readonly (number | null)[];
  /** Signed time delta from the focus car, indexed by CarIdx. */
  deltas: readonly (number | null)[];
  sessionNum: number | null;
  version: number;
}

export interface ReferenceLapsSnapshot {
  bestLaps: readonly (readonly [number, ReferenceLap])[];
  persistedLaps: readonly (readonly [number, ReferenceLap])[];
  sessionNum: number | null;
  version: number;
}

export interface CarSpeedsSnapshot {
  /** Smoothed speed in km/h for each car index. */
  carSpeeds: readonly number[];
  sessionNum: number | null;
  version: number;
}

export interface LapTimesSnapshot {
  /** Median filtered pace for each car index. */
  lapTimes: readonly number[];
  /** At most the ten most recent observed lap times per car index. */
  lapTimeHistory: readonly (readonly number[])[];
  sessionNum: number | null;
  version: number;
}

export interface FuelProjectionEngineSnapshot {
  accumulatedRefuel: number;
  isLapDistPctReset: boolean;
  lapCrossingTime: number;
  lapStartFuel: number;
  lastLap: number;
  lastLapDistPct: number;
  lastSessionFlags: number;
  wasOnPitRoad: boolean;
}

export interface FuelProjectionSnapshot {
  /** True for recorded tape sources; recorded laps must not touch live storage. */
  isReplay: boolean;
  fuelLevel: number;
  fuelLevelPct: number;
  currentLap: number;
  lapDistPct: number;
  currentLapUsage: number;
  projectedLapUsage: number;
  lastLapUsage: number;
  sessionLapsRemain: number;
  sessionTimeRemain: number;
  sessionTimeTotal: number;
  sessionFlags: number;
  sessionState: number;
  sessionNum: number;
  sessionLaps: number | string;
  calculatedTotalRaceLaps: number;
  estimatedLapsRemaining: number;
  hasValidRaceEstimate: boolean;
  isFixedLapRace: boolean;
  sessionType?: string;
  isOnTrack: boolean;
  trackId?: string | number;
  carName?: string;
  fuelTankCapacity?: number;
  completedLaps: readonly FuelLapData[];
  engine: FuelProjectionEngineSnapshot;
}

export type ChannelName = keyof ChannelPayloads;

export type ChannelDefinition =
  | {
      kind: 'snapshot';
      defaultRateHz: number;
      maxRateHz: number;
    }
  | {
      kind: 'event';
    };

export type ChannelRegistry = Readonly<Record<ChannelName, ChannelDefinition>>;

export const channelRegistry = {
  'blind-spot.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 25,
    maxRateHz: 25,
  },
  'car-speeds.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 10,
    maxRateHz: 25,
  },
  'driver-controls.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 25,
    maxRateHz: 60,
  },
  'fuel.projection': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 25,
  },
  'lap-times.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 25,
  },
  'lap-log.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 25,
    maxRateHz: 25,
  },
  // Publishes on version change, roughly 0.6 times a second in a 60-car field.
  // The rate cap only bounds the worst case; it is not a sampling rate.
  'lap-history.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 2,
    maxRateHz: 5,
  },
  'reference-laps.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 5,
  },
  'radio.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 25,
    maxRateHz: 25,
  },
  'relative-gaps.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 25,
  },
  'sector-timing.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 10,
    maxRateHz: 25,
  },
  'session-timing.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 10,
  },
  'session-bar.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 10,
  },
  'standings.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 10,
  },
  'track-state.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 25,
    maxRateHz: 25,
  },
  'session.lifecycle': { kind: 'event' },
  'raceControl.incidents': { kind: 'event' },
  'raceControl.sessionId': { kind: 'event' },
} as const satisfies ChannelRegistry;

export interface ChannelBridge {
  subscribe<K extends ChannelName>(
    channel: K,
    callback: (payload: ChannelPayloads[K]) => void,
    requestedRateHz?: number
  ): () => void;
}
