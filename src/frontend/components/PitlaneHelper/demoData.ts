// Demo data for Pitlane Helper component

export interface PitSpeedResult {
  deltaKph: number;
  deltaMph: number;
  limitKph: number;
  limitMph: number;
  speedKph: number;
  speedMph: number;
  colorClass: string;
  isPulsing: boolean;
  isSpeeding: boolean;
  isSeverelyOver: boolean;
}

export interface PitboxPositionResult {
  distanceToPit: number;
  distanceToPitEntry: number;
  distanceToPitExit: number;
  progressPercent: number;
  isApproaching: boolean;
  pitboxPct: number;
  playerPct: number;
  isEarlyPitbox: boolean;
}

export interface PitLimiterWarningResult {
  showWarning: boolean;
  warningText: string;
  isTeamRaceWarning: boolean;
}

export interface PitlaneTrafficResult {
  carsAhead: number;
  carsBehind: number;
  totalCars: number;
}

export interface PitlaneHelperSettings {
  showMode: 'approaching' | 'onPitRoad';
  approachDistance: number;
  progressBarOrientation: 'vertical' | 'horizontal';
  showSpeedBar: boolean;
  showPitExitInputs: boolean;
  pitExitInputs: {
    throttle: boolean;
    clutch: boolean;
  };
  showInputsPhase: 'always' | 'atPitbox' | 'afterPitbox';
  enablePitLimiterWarning: boolean;
  enableEarlyPitboxWarning: boolean;
  earlyPitboxThreshold: number;
  showPitlaneTraffic: boolean;
  background: { opacity: number };
}

export interface PitlaneHelperDemoData {
  speed: PitSpeedResult;
  position: PitboxPositionResult;
  isVisible: boolean;
  limiterWarning: PitLimiterWarningResult;
  traffic: PitlaneTrafficResult;
  surface: number;
}

// Demo data for pitlane helper
export const getDemoPitlaneData = (): PitlaneHelperDemoData => {
  return {
    speed: {
      deltaKph: 2.5,
      deltaMph: 1.6,
      limitKph: 60,
      limitMph: 37.3,
      speedKph: 62.5,
      speedMph: 38.8,
      colorClass: 'text-red-500',
      isPulsing: false,
      isSpeeding: true,
      isSeverelyOver: false,
    },
    position: {
      distanceToPit: 45,
      distanceToPitEntry: 0,
      distanceToPitExit: 85,
      progressPercent: 75,
      isApproaching: true,
      pitboxPct: 0.85,
      playerPct: 0.8,
      isEarlyPitbox: false,
    },
    isVisible: true,
    limiterWarning: {
      showWarning: true,
      warningText: 'ENGAGE PIT LIMITER',
      isTeamRaceWarning: false,
    },
    traffic: {
      carsAhead: 2,
      carsBehind: 1,
      totalCars: 3,
    },
    surface: 2, // On pit road
  };
};
