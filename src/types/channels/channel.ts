import type { FuelLapData } from '../fuelCalculatorBridge';
import type { ReferenceLap } from '../referenceLaps';

export type SessionLifecycleEvent =
  | { type: 'enter'; replay: boolean }
  | { type: 'sessionNumChange' }
  | { type: 'disconnect' };

export interface ChannelPayloads {
  'car-speeds.snapshot': CarSpeedsSnapshot;
  'fuel.projection': FuelProjectionSnapshot;
  'lap-times.snapshot': LapTimesSnapshot;
  'reference-laps.snapshot': ReferenceLapsSnapshot;
  'relative-gaps.snapshot': RelativeGapsSnapshot;
  'session.lifecycle': SessionLifecycleEvent;
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
  'car-speeds.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 10,
    maxRateHz: 25,
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
  'reference-laps.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 5,
  },
  'relative-gaps.snapshot': {
    kind: 'snapshot',
    defaultRateHz: 5,
    maxRateHz: 25,
  },
  'session.lifecycle': { kind: 'event' },
} as const satisfies ChannelRegistry;

export interface ChannelBridge {
  subscribe<K extends ChannelName>(
    channel: K,
    callback: (payload: ChannelPayloads[K]) => void,
    requestedRateHz?: number
  ): () => void;
}
