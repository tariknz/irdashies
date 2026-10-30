// Demo data for Pitlane Helper component

export type { PitSpeedResult } from './hooks/usePitSpeed';

import type { PitSpeedResult } from './hooks/usePitSpeed';
import { speedFromKph } from '@irdashies/utils/units';

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

const LIMIT_KPH = 60;
const PIT_RUN_S = 12;

const speedFromDemoKph = (speedKph: number): PitSpeedResult => {
  const limitMph = speedFromKph(LIMIT_KPH, 'mph');
  const speedMph = speedFromKph(speedKph, 'mph');
  const deltaKph = speedKph - LIMIT_KPH;
  const deltaMph = speedMph - limitMph;
  let colorClass = 'text-green-500';
  let isPulsing = false;
  if (deltaKph >= 2) {
    colorClass = 'text-red-500';
    isPulsing = true;
  } else if (deltaKph > 0) {
    colorClass = 'text-red-500';
  } else if (deltaKph > -5) {
    colorClass = 'text-amber-500';
  }
  return {
    deltaKph,
    deltaMph,
    limitKph: LIMIT_KPH,
    limitMph,
    hasLimit: true,
    speedKph,
    speedMph,
    colorClass,
    isPulsing,
    isSpeeding: deltaKph > 0,
    isSeverelyOver: deltaKph > 1.5,
  };
};

/**
 * Demo snapshot at `elapsedSec`. Progress runs the pit lane; speed hunts
 * around the limit so the delta / limiter warning visibly change.
 */
export const getDemoPitlaneData = (
  elapsedSec = 0
): PitlaneHelperDemoData => {
  const progress = ((elapsedSec % PIT_RUN_S) / PIT_RUN_S) * 100;
  const speedKph = LIMIT_KPH + Math.sin(elapsedSec * 1.2) * 4;
  const speed = speedFromDemoKph(speedKph);
  const carsAhead = 1 + Math.floor((Math.sin(elapsedSec * 0.35) + 1) * 1.5);
  const carsBehind = Math.floor((Math.sin(elapsedSec * 0.5 + 1) + 1) * 1.5);

  return {
    speed,
    position: {
      distanceToPit: Math.max(0, 120 * (1 - progress / 100)),
      distanceToPitEntry: 0,
      distanceToPitExit: Math.max(0, 150 * (1 - progress / 100) + 30),
      progressPercent: progress,
      isApproaching: progress < 95,
      pitboxPct: 0.85,
      playerPct: 0.85 * (progress / 100),
      isEarlyPitbox: progress > 20 && progress < 35,
    },
    isVisible: true,
    limiterWarning: {
      showWarning: speed.isSpeeding,
      warningText: 'ENGAGE PIT LIMITER',
      isTeamRaceWarning: false,
    },
    traffic: {
      carsAhead,
      carsBehind,
      totalCars: carsAhead + carsBehind,
    },
    surface: 2,
  };
};
