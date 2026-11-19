// Demo data for Pitlane Helper component

// Re-exported rather than redeclared. This file used to carry its own copy of
// the shape, and the component imports the copy from here -- so a field added
// to the hook's result was missing on the type the component was checked
// against, and the component could not see it at all.
export type { PitSpeedResult } from './hooks/usePitSpeed';

import type { PitSpeedResult } from './hooks/usePitSpeed';

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
  speedBarOrientation: 'vertical' | 'horizontal';
  showProgressBar: boolean;
  showPastPitBox: boolean;
  showSpeedSummary: boolean;
  showSpeedDelta: boolean;
  speedLimitStyle: 'none' | 'text' | 'european' | 'american';
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

/** Approach → pit box → exit over ~16s, with speed/limiter pulsing. */
export const getDemoPitlaneData = (elapsedSec = 0): PitlaneHelperDemoData => {
  const cycle = 16;
  const t = elapsedSec % cycle;
  const progress = Math.min(100, (t / 12) * 100);
  const playerPct = Math.min(0.98, 0.15 + (t / 12) * 0.8);
  const overLimit = t < 5 || (t > 9 && t < 12);
  const deltaKph = overLimit
    ? 1.5 + Math.sin(elapsedSec * 3) * 2.5
    : -2 + Math.sin(elapsedSec * 2);
  const speedKph = 60 + deltaKph;
  const isSpeeding = deltaKph > 0;
  const showLimiter = overLimit;

  return {
    speed: {
      deltaKph,
      deltaMph: deltaKph * 0.621,
      limitKph: 60,
      limitMph: 37.3,
      hasLimit: true,
      speedKph,
      speedMph: speedKph * 0.621,
      colorClass: isSpeeding ? 'text-red-500' : 'text-green-400',
      isPulsing: isSpeeding,
      isSpeeding,
      isSeverelyOver: deltaKph > 3,
    },
    position: {
      distanceToPit: Math.max(0, 120 - t * 12),
      distanceToPitEntry: Math.max(0, 40 - t * 8),
      distanceToPitExit: Math.max(0, 160 - t * 12),
      progressPercent: progress,
      isApproaching: t < 4,
      pitboxPct: 0.75,
      playerPct,
      isEarlyPitbox: t > 3 && t < 5,
    },
    isVisible: true,
    limiterWarning: {
      showWarning: showLimiter,
      warningText: showLimiter ? 'ENGAGE PIT LIMITER' : '',
      isTeamRaceWarning: false,
    },
    traffic: {
      carsAhead: t < 8 ? 2 : 1,
      carsBehind: t < 6 ? 1 : 2,
      totalCars: 3,
    },
    surface: 2,
  };
};
