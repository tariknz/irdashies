export enum IncidentType {
  PitEntry = 'PitEntry',
  OffTrack = 'OffTrack',
  Slowdown = 'Slowdown',
  Crash = 'Crash',
  BlackFlag = 'BlackFlag',
}

/**
 * Durations are in seconds rather than telemetry frames. Frame counts drifted
 * with the tick rate - the same setting meant 0.5s or 0.8s depending on load -
 * so a threshold tuned in one session behaved differently in the next.
 */
export interface IncidentThresholds {
  slowSpeedThreshold: number; // km/h, default 15
  slowDurationSeconds: number; // seconds below the slow speed, default 1
  /**
   * Deceleration that counts as an impact, in km/h per second.
   *
   * Rate is the only measure that separates a crash from braking. A "speed
   * dropped from A to B within W" gate only ever expresses (A-B)/W, so any
   * setting that rejects hard braking also rejects every impact gentler than
   * hard braking. Rate splits them cleanly because the two do not overlap:
   * hard braking tops out near 45 km/h/s in a road car and 90 in a
   * high-downforce one, while hitting a wall starts around 250.
   *
   * See SPEED_BASELINE_S in services/speedBaseline for how the rate is
   * measured, and why measuring it badly made this setting untunable.
   */
  impactDecelKmhPerSec: number; // km/h per second, default 150
  /** Speed the car must have been carrying for an impact to count, km/h. */
  impactMinSpeed: number; // km/h, default 20
  offTrackDurationSeconds: number; // seconds off the surface, default 0.3
  pitEntryDurationSeconds: number; // seconds on pit road, default 0.6
  cooldownSeconds: number; // seconds, default 5
}

export const INCIDENT_THRESHOLD_BOUNDS = {
  slowSpeedThreshold: { min: 1, max: 100 },
  slowDurationSeconds: { min: 0.1, max: 10 },
  impactDecelKmhPerSec: { min: 50, max: 600 },
  impactMinSpeed: { min: 5, max: 100 },
  offTrackDurationSeconds: { min: 0.1, max: 3 },
  pitEntryDurationSeconds: { min: 0.1, max: 5 },
  cooldownSeconds: { min: 1, max: 30 },
} as const satisfies Record<
  keyof IncidentThresholds,
  { min: number; max: number }
>;

export interface IncidentDebugSnapshot {
  trigger:
    | 'sustained-slow'
    | 'impact'
    | 'off-track'
    | 'pit-entry'
    | 'black-flag'
    | 'slowdown-flag';
  evidence: string;
  thresholds: IncidentThresholds;
  carStateAtDetection: {
    currentAvgSpeed: number;
    /**
     * The raw position readings the speed was measured from. Kept in the log
     * because a bad speed is almost always a position that did not refresh in
     * step with sessionTime, which is only visible here.
     */
    recentPositions: { sessionTime: number; lapDistPct: number }[];
    /** How long the condition had held when the incident fired, in seconds. */
    slowForSeconds: number;
    offTrackForSeconds: number;
    prevTrackSurface: number;
    prevSessionFlags: number;
    prevOnPitRoad: boolean;
    prevLapDistPct: number;
  };
  frameHistory: {
    speed: number;
    lapDistPct: number;
    trackSurface: number;
    sessionTime: number;
  }[];
}

export interface Incident {
  id: string;
  carIdx: number;
  driverName: string;
  carNumber: string;
  teamName: string;
  sessionNum: number;
  sessionTime: number;
  lapNum: number;
  replayFrameNum: number;
  type: IncidentType;
  lapDistPct: number;
  timestamp: number;
  debug?: IncidentDebugSnapshot;
}

export interface CarIncidentState {
  prevTrackSurface: number;
  prevSessionFlags: number;
  prevOnPitRoad: boolean;
  prevLapDistPct: number;
  prevSessionTime: number;
  /** Session time when lap distance last changed. */
  lastPositionChangeSessionTime: number;
  /** Speed over the most recent baseline, in km/h. */
  currentAvgSpeed: number;
  /**
   * Raw position history, trimmed to the impact window. Speed is measured from
   * this rather than frame to frame - see SPEED_BASELINE_S in incidentDetector.
   */
  recentPositions: { sessionTime: number; lapDistPct: number }[];
  /** Highest recent speed, decayed over time so it reflects the last ~2s. */
  recentPeakSpeed: number;
  /** Session time the impact condition first held, for the confirm delay. */
  impactPendingSince: number | null;
  /**
   * Session time each condition started, or null when it is not active.
   * Duration is measured against these rather than counting frames.
   */
  slowSinceSessionTime: number | null;
  offTrackSinceSessionTime: number | null;
  onPitRoadSinceSessionTime: number | null;
  /**
   * Latches so a sustained condition reports once per occurrence rather than
   * once per cooldown window. Cleared when the condition ends, and set during
   * seeding for a condition that is already true, so re-seeding mid-pit-stop
   * does not report a car that never moved.
   */
  pitEntryReported: boolean;
  offTrackReported: boolean;
  slowReported: boolean;
  /** Last incident time by type, in telemetry session seconds. */
  lastIncidentTime: Record<string, number>;
  hasPrevFrame: boolean;
}

export interface RaceControlBridge {
  getIncidents: () => Promise<{
    /** SubSessionID used to select the persisted incident file. */
    sessionId: string;
    incidents: Incident[];
  }>;
  replayIncident: (incident: Incident, seconds: number) => Promise<void>;
  /** Points the sim's camera at a car, without moving the replay position. */
  focusDriver: (carNumber: string) => Promise<void>;
  clearIncidents: () => Promise<void>;
  updateThresholds: (thresholds: IncidentThresholds) => Promise<void>;
  updateRetention: (retention: 'all' | 5 | 10 | 20) => Promise<void>;
  /** Resolves false when the Gantry widget is disabled and nothing opened. */
  showGantryWindow: () => Promise<boolean>;
}
