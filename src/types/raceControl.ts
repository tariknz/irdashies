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
  cooldownSeconds: number; // seconds, default 5
}

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
  speedHistory: number[];
  currentAvgSpeed: number;
  recentRawSpeeds: number[];
  slowFrameCount: number;
  offTrackFrameCount: number;
  lastIncidentTime: Record<string, number>;
}

export interface RaceControlBridge {
  getIncidents: () => Promise<Incident[]>;
  onIncident: (cb: (incident: Incident) => void) => () => void;
  replayIncident: (incident: Incident, seconds: number) => Promise<void>;
  clearIncidents: () => Promise<void>;
  updateThresholds: (thresholds: IncidentThresholds) => Promise<void>;
  updateRetention: (retention: 'all' | 5 | 10 | 20) => Promise<void>;
}
