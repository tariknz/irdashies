/**
 * Types for enhanced relative time gap calculation system
 * Based on design document: iracing_relative_time_design.md
 */

/**
 * A single position sample at a specific point on track
 */
export interface PositionSample {
  /** Position on track as percentage (0.0 to 1.0) */
  position: number;
  /** Time at this position in seconds from lap start */
  time: number;
  /** Session time when this sample was recorded (for debugging) */
  sessionTime: number;
}

/**
 * Complete position/time record for a single lap
 */
export interface LapPositionRecord {
  /** Lap number this record is for */
  lapNumber: number;
  /** Array of position samples, sorted by position */
  samples: PositionSample[];
  /** Total lap time in seconds */
  lapTime: number;
  /** Session time when lap was completed */
  completedAt: number;
  /** Whether this lap was considered valid (not an outlier) */
  isValid: boolean;
}

/**
 * Historical data for a single car
 */
export interface CarPositionHistory {
  /** Car index */
  carIdx: number;
  /** Recent lap records (up to 5 laps) */
  lapRecords: LapPositionRecord[];
  /** Current lap being sampled */
  currentLapSamples: PositionSample[];
  /** Last known position for current lap */
  lastPosition: number;
  /** Current lap number */
  currentLapNumber: number;
  /** Lap start time */
  lapStartTime: number;
}

/**
 * Calculated relative gap between two cars
 */
export interface RelativeGap {
  /** Time gap in seconds (positive = ahead, negative = behind) */
  timeGap: number;
  /** Which tier was used for calculation */
  tier: 'position-records' | 'lap-history' | 'class-estimate';
  /** Confidence level in the calculation (0.0 to 1.0) */
  confidence: number;
  /** Whether this gap is currently being smoothed/filtered */
  isEstimated: boolean;
  /** Distance-based gap in track percentage for reference */
  distanceGap: number;
}

/**
 * Configuration for the relative gap calculation system
 */
export interface RelativeGapConfig {
  /** Sample interval as percentage of track (default: 0.01 = 1%) */
  sampleInterval: number;
  /** Maximum number of laps to keep in history */
  maxLapHistory: number;
  /** Interpolation method to use */
  interpolationMethod: 'linear' | 'cubic';
  /** Smoothing factor for exponential moving average (0.0 to 1.0) */
  smoothingFactor: number;
  /** Whether to enable advanced gap calculation */
  enabled: boolean;
}

/**
 * Store state for relative gap calculations
 */
export interface RelativeGapStoreState {
  /** Position history for all cars, keyed by carIdx */
  carHistories: Map<number, CarPositionHistory>;
  /** Configuration */
  config: RelativeGapConfig;
  /** Current session number (to detect session changes) */
  sessionNum: number;
  /** Track length in meters (needed for some calculations) */
  trackLength: number;
}

/**
 * Result of interpolation calculation
 */
export interface InterpolationResult {
  /** Interpolated time value */
  time: number;
  /** Whether this was interpolated (true) or extrapolated (false) */
  isInterpolated: boolean;
  /** Confidence in the result (0.0 to 1.0) */
  confidence: number;
}

/**
 * Parameters for gap calculation
 */
export interface GapCalculationParams {
  /** Player car index */
  playerCarIdx: number;
  /** Other car index */
  otherCarIdx: number;
  /** Player's current lap distance percentage */
  playerPosition: number;
  /** Other car's current lap distance percentage */
  otherPosition: number;
  /** Player's lap number */
  playerLap: number;
  /** Other car's lap number */
  otherLap: number;
  /** Current session time */
  sessionTime: number;
}

/**
 * Edge case flags for special handling
 */
export interface EdgeCaseFlags {
  /** Car is currently off track */
  isOffTrack: boolean;
  /** Car is in pit lane */
  isInPits: boolean;
  /** Car is on first lap with no history */
  isFirstLap: boolean;
  /** Car is lapped (different lap number than player) */
  isLapped: boolean;
  /** Telemetry appears to have glitched */
  isTelemetryGlitch: boolean;
}
