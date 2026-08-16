export enum IncidentType {
  PitEntry = 'PitEntry',
  OffTrack = 'OffTrack',
  Slowdown = 'Slowdown',
  Crash = 'Crash',
  BlackFlag = 'BlackFlag',
}

export interface IncidentThresholds {
  slowSpeedThreshold: number; // km/h, default 15
  slowFrameThreshold: number; // frames, default 10
  suddenStopFromSpeed: number; // km/h, default 80
  suddenStopToSpeed: number; // km/h, default 20
  suddenStopFrames: number; // frames, default 3
  offTrackDebounce: number; // frames, default 3
  pitEntryDebounce: number; // frames, default 3
  cooldownSeconds: number; // seconds, default 5
}

export const INCIDENT_THRESHOLD_BOUNDS = {
  slowSpeedThreshold: { min: 1, max: 100 },
  slowFrameThreshold: { min: 1, max: 60, integer: true },
  suddenStopFromSpeed: { min: 20, max: 300 },
  suddenStopToSpeed: { min: 1, max: 50 },
  suddenStopFrames: { min: 1, max: 10, integer: true },
  offTrackDebounce: { min: 1, max: 10, integer: true },
  pitEntryDebounce: { min: 1, max: 10, integer: true },
  cooldownSeconds: { min: 1, max: 30 },
} as const satisfies Record<
  keyof IncidentThresholds,
  { min: number; max: number; integer?: boolean }
>;

export interface IncidentDebugSnapshot {
  trigger:
    | 'sustained-slow'
    | 'sudden-stop'
    | 'off-track'
    | 'pit-entry'
    | 'black-flag'
    | 'slowdown-flag';
  evidence: string;
  thresholds: IncidentThresholds;
  carStateAtDetection: {
    speedHistory: number[];
    currentAvgSpeed: number;
    recentRawSpeeds: number[];
    slowFrameCount: number;
    offTrackFrameCount: number;
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
  speedHistory: number[];
  currentAvgSpeed: number;
  recentRawSpeeds: number[];
  /** Highest recent speed, decayed each tick so it reflects the last ~2s. */
  recentPeakSpeed: number;
  slowFrameCount: number;
  offTrackFrameCount: number;
  onPitRoadFrameCount: number;
  /**
   * Latches so a sustained condition reports once per occurrence rather than
   * once per cooldown window. Cleared when the condition ends, and set during
   * seeding for a condition that is already true, so re-seeding mid-pit-stop
   * does not report a car that never moved.
   */
  pitEntryReported: boolean;
  offTrackReported: boolean;
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
