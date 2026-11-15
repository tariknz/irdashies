/** Rule families from the 26S4 pit regulations table. */
export type PitRuleFamily = 'default' | 'imsa' | 'nec' | 'dtm';

export type PitServiceSequencing = 'fuelThenTyres' | 'simultaneous';

export interface PitServiceRule {
  fuelLitresPerSecond: number;
  fourTyreSeconds: number;
  sequencing: PitServiceSequencing;
  /**
   * Fixed time stationary on every stop with service: from stopping in the
   * box to service starting, plus the hold after it ends before release.
   */
  overheadSeconds: number;
}

export type PitEstimateSource =
  | 'override'
  | 'learnedCar'
  | 'learnedClass'
  | 'learnedTrack'
  | 'table'
  | 'tableDefault'
  | 'model'
  | 'generic'
  | 'none';

interface PitSampleContext {
  /** Epoch milliseconds. */
  at: number;
  build: string;
  seriesId: number;
  trackId: number;
  carId: number;
  carClassId: number;
  /** Lower-cased `WeekendInfo.AltAssetTag`, or `default` when absent. */
  ruleSet: string;
}

/** One car's drive through the pit lane. Recorded for every car. */
export interface PitTransitSample extends PitSampleContext {
  source: 'player' | 'opponent';
  pitSpeedLimitKph: number;
  entryPct: number;
  exitPct: number;
  /** Time across the measuring window around the lane, stall time included. */
  windowSeconds: number;
  stationarySeconds: number;
  /** Reference lap time over the same window, or null if none was known. */
  referenceSeconds: number | null;
  windowStartPct: number;
  windowEndPct: number;
}

/** What happened in the box. Recorded for the player's car only. */
export interface PitServiceSample extends PitSampleContext {
  /** Time `PitstopActive` was set. */
  serviceSeconds: number;
  /** Time stopped in the box. Absent on samples from before it was recorded. */
  stationarySeconds?: number;
  fuelAddedLitres: number;
  /** First to last rise of the fuel level, or null if no fuel went in. */
  fuelSeconds: number | null;
  tankLitres: number;
  tankPct: number;
  /** Bitmask LF=1, RF=2, LR=4, RR=8. */
  tyresChanged: number;
  repairSeconds: number;
  fastRepair: boolean;
  tearOff: boolean;
}

export interface PitStopModelFile {
  version: 1;
  /** Keyed `${trackId}:${carId}`. */
  transit: Record<string, PitTransitSample[]>;
  /** Keyed `${ruleSet}:${carId}`. */
  service: Record<string, PitServiceSample[]>;
  /** Keyed `${ruleSet}:${carId}`, hand-edited. */
  overrides: Record<string, Partial<PitServiceRule>>;
  /** Keys from oldest to most recent use, for pruning. */
  order: string[];
}

export type PitStopEstimateState =
  'hidden' | 'calibrating' | 'ok' | 'unreliable';

export interface PitStopEstimateSnapshot {
  state: PitStopEstimateState;
  /**
   * Distance behind the player's car where it would rejoin, as a fraction of
   * a lap (0..1, whole laps removed). Added to the player's live position.
   */
  offsetPct: number | null;
  /** Bound with the larger loss, so further behind. */
  offsetFarPct: number | null;
  /** Bound with the smaller loss, so closer behind. */
  offsetNearPct: number | null;
  lapsLost: number;
  lossSeconds: number | null;
  /** True when a fuel stop is still needed to finish; null if unknown. */
  fuelStopNeeded: boolean | null;
  /** The player is making a stop: the rejoin point counts down the loss left. */
  inStop: boolean;
  /** The nearest cars each side of the rejoin point when the player gets there. */
  aheadCarIdx: number | null;
  /** Seconds on the player's reference lap, to one decimal place. */
  aheadGapSeconds: number | null;
  behindCarIdx: number | null;
  behindGapSeconds: number | null;
  sessionNum: number | null;
  version: number;
}

/** Why a stop was left out of the learned data. */
export type PitStopTaintReason =
  | 'caution'
  | 'towed'
  | 'noPosition'
  | 'notInWorld'
  | 'approachNotSeen'
  | 'approachTooOld'
  | 'longStop';

export interface PitStopEstimateBreakdown {
  lossSeconds: number;
  lossFarSeconds: number;
  lossNearSeconds: number;
  laneSeconds: number;
  laneSource: PitEstimateSource;
  serviceSeconds: number;
  fuelRateSource: PitEstimateSource;
  tyreSource: PitEstimateSource;
  overheadSeconds: number;
  overheadSource: PitEstimateSource;
  fuelLitres: number;
  fuelSource: 'pitMenu' | 'none';
  tyres: number;
  repairSeconds: number;
  tableRow: string | null;
  ruleFamily: PitRuleFamily;
}

/** Written to the log when a player stop ends, for testers to send back. */
export interface PitStopReport {
  /** Epoch milliseconds when the stop ended. */
  at: number;
  seriesId: number;
  sessionType: string;
  /** The player's lap when entering the pit lane. */
  lap: number | null;
  cautionDuringStop: boolean;
  /** Empty for a clean stop, which is learned from. */
  taintReasons: PitStopTaintReason[];
  /** Seconds after pit entry when the stop was first tainted. */
  firstTaintSeconds: number | null;
  trackId: number;
  carId: number;
  carClassId: number;
  carPath: string;
  ruleSet: string;
  build: string;
  predicted: PitStopEstimateBreakdown | null;
  actualLossSeconds: number | null;
  actualStationarySeconds: number;
  actualServiceSeconds: number;
  actualFuelLitres: number;
  actualFuelSeconds: number | null;
  actualTyres: number;
  predictedAheadCarIdx: number | null;
  predictedBehindCarIdx: number | null;
  actualAheadCarIdx: number | null;
  actualBehindCarIdx: number | null;
  /** Reference-lap seconds to those cars: predicted at pit entry, actual at the end of the measuring window. */
  predictedAheadGapSeconds: number | null;
  predictedBehindGapSeconds: number | null;
  actualAheadGapSeconds: number | null;
  actualBehindGapSeconds: number | null;
}
