import { Standings } from './createStandings';
import {
  normalizeKey,
  REFERENCE_INTERVAL,
  ReferenceLap,
} from './hooks/useReferenceRegistry';

const FALLBACK_LAPTIME = 90;
// Helper to grab clean numbers (prevents null/undefined mess)
export function getStats(estTime: number, driver: Standings | undefined) {
  const stats = {
    estTime,
    classEstTime: driver?.carClass.estLapTime ?? FALLBACK_LAPTIME,
  };

  return stats;
}

/**
 * Calculates the time gap between two cars using class-normalized estimated times.
 *
 * logic:
 * The Reference Ruler is ALWAYS the car physically BEHIND.
 * We scale the car AHEAD to match the class performance of the car BEHIND.
 *
 * @param carAhead - Stats for the car physically further along the track (0.9 vs 0.1).
 * @param carBehind - Stats for the car physically earlier on the track.
 * @param isTargetAhead - TRUE if we want the gap TO the car ahead (Positive), FALSE if TO the car behind (Negative).
 */

export function calculateClassEstimatedGap(
  carAhead: { estTime: number; classEstTime: number },
  carBehind: { estTime: number; classEstTime: number },
  isTargetAhead: boolean
): number {
  // 1. Normalize: Scale the 'Ahead' car's time into 'Behind' car's units
  // Ratio > 1.0 means Behind is Slower (GT3 chasing GTP) -> Gap gets larger
  // Ratio < 1.0 means Behind is Faster (GTP chasing GT3) -> Gap gets smaller
  const scalingRatio = carBehind.classEstTime / carAhead.classEstTime;
  const aheadTimeScaled = carAhead.estTime * scalingRatio;

  const referenceLapTime = carBehind.classEstTime;
  let delta = 0;

  if (isTargetAhead) {
    // Scenario: We want the gap TO the car Ahead (Expected: Positive)
    // Formula: (Ahead) - (Behind)
    delta = aheadTimeScaled - carBehind.estTime;

    // Wrap Check: If delta is huge negative (e.g. -100s), Ahead actually lapped Behind
    if (delta < -referenceLapTime / 2) {
      delta += referenceLapTime;
    }
  } else {
    // Scenario: We want the gap TO the car Behind (Expected: Negative)
    // Formula: (Behind) - (Ahead)
    delta = carBehind.estTime - aheadTimeScaled;

    // Wrap Check: If delta is huge positive (e.g. +100s), Behind actually lapped Ahead
    if (delta > referenceLapTime / 2) {
      delta -= referenceLapTime;
    }
  }

  return delta;
}

export function getTimeAtPosition(refLap: ReferenceLap, trackPct: number) {
  const prevPosKey = normalizeKey(trackPct);
  const nextKey =
    trackPct + REFERENCE_INTERVAL > 1 ? 0 : trackPct + REFERENCE_INTERVAL;
  const nextPosKey = normalizeKey(nextKey);

  const prevPosRef = refLap.refPoints.get(prevPosKey) ?? {
    timeElapsedSinceStart: 0,
    trackPct,
  };
  const nextPosRef = refLap.refPoints.get(nextPosKey) ?? {
    timeElapsedSinceStart: 0,
    trackPct,
  };

  const sectorDistance = nextPosRef.trackPct - prevPosRef.trackPct;

  const fraction =
    (trackPct - prevPosRef.trackPct) / sectorDistance === 0
      ? 1
      : sectorDistance;

  const timeDiff =
    nextPosRef.timeElapsedSinceStart - prevPosRef.timeElapsedSinceStart;

  return prevPosRef.timeElapsedSinceStart + fraction * timeDiff;
}

export function calculateReferenceDelta(
  referenceLap: ReferenceLap,
  opponentTrackPct: number,
  playerTrackPct: number
): number {
  const timeFocus = getTimeAtPosition(referenceLap, playerTrackPct);
  const timeOther = getTimeAtPosition(referenceLap, opponentTrackPct);

  let calculatedDelta = timeOther - timeFocus;
  const lapTime = referenceLap.finishTime - referenceLap.startTime;

  if (calculatedDelta <= -lapTime / 2) {
    calculatedDelta += lapTime;
  } else if (calculatedDelta >= lapTime / 2) {
    calculatedDelta -= lapTime;
  }

  return calculatedDelta;
}

export function calculateRelativeDist(
  focusDistPct: number,
  otherDistPct: number
) {
  if (focusDistPct === undefined || otherDistPct === undefined) {
    return NaN;
  }

  const relativePct = otherDistPct - focusDistPct;

  if (relativePct > 0.5) {
    return relativePct - 1.0;
  } else if (relativePct < -0.5) {
    return relativePct + 1.0;
  }

  return relativePct;
}
