import { useCallback, useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
  useTelemetryValue,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import {
  normalizeKey,
  REFERENCE_INTERVAL,
  ReferenceLap,
  useReferenceRegistry,
} from './useReferenceRegistry';
import { Standings } from '../createStandings';

const FALLBACK_LAPTIME = 90;
// Helper to grab clean numbers (prevents null/undefined mess)
function getStats(estTime: number, driver: Standings | undefined) {
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
const calculateClassEstimatedGap = (
  carAhead: { estTime: number; classEstTime: number },
  carBehind: { estTime: number; classEstTime: number },
  isTargetAhead: boolean
): number => {
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
};

function getTimeAtPosition(refLap: ReferenceLap, trackPct: number) {
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

  const fraction =
    (trackPct - prevPosRef.trackPct) /
    (nextPosRef?.trackPct - prevPosRef.trackPct);

  const timeDiff =
    nextPosRef.timeElapsedSinceStart - prevPosRef.timeElapsedSinceStart;

  return prevPosRef.timeElapsedSinceStart + fraction * timeDiff;
}

function calculateReferenceDelta(
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

const calculateRelativeDist = (focusDistPct: number, otherDistPct: number) => {
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
};
export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxIsOnPitRoad = useTelemetryValues('CarIdxOnPitRoad');
  // CarIdxEstTime - iRacing's native estimated time gap calculation
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const focusCarIdx = useFocusCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;
  const { collectLapData, getReferenceLap } = useReferenceRegistry();
  const sessionTime = useTelemetryValue<number>('SessionTime') ?? 0;

  // Driver lookup map
  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.carIdx, d])),
    [drivers]
  );

  const calculateRelativePct = useCallback(
    (carIdx: number) => {
      if (focusCarIdx === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct?.[focusCarIdx];
      const otherDistPct = carIdxLapDistPct?.[carIdx];

      return calculateRelativeDist(playerDistPct, otherDistPct);
    },
    [focusCarIdx, carIdxLapDistPct]
  );

  const calculateDelta = useCallback(
    (otherCarIdx: number) => {
      const focusIdx = focusCarIdx ?? 0;

      if (focusIdx === otherCarIdx) {
        return 0;
      }

      const focusDriver = driverMap.get(focusIdx);
      const otherDriver = driverMap.get(otherCarIdx);

      const isOnPitRoadFocus = carIdxIsOnPitRoad[focusIdx];
      const isOnPitRoadOther = carIdxIsOnPitRoad[otherCarIdx];

      const focusTrckPct = carIdxLapDistPct[focusIdx];
      const otherTrckPct = carIdxLapDistPct[otherCarIdx];

      let calculatedDelta = 0;
      const relativeDistPct = calculateRelativeDist(focusTrckPct, otherTrckPct);
      const isTargetAhead = relativeDistPct > 0 && relativeDistPct <= 0.5;

      if (isTargetAhead) {
        const focusLap = getReferenceLap(focusIdx);

        const hasNoDataOrIsPit =
          isOnPitRoadFocus || isOnPitRoadOther || focusLap.finishTime <= 0;

        if (hasNoDataOrIsPit) {
          const focusEstTime = carIdxEstTime[focusIdx];
          const otherEstTime = carIdxEstTime[otherCarIdx];

          calculatedDelta = calculateClassEstimatedGap(
            getStats(otherEstTime, otherDriver), // Ahead
            getStats(focusEstTime, focusDriver), // Behind
            isTargetAhead
          );
        } else {
          calculatedDelta = calculateReferenceDelta(
            focusLap,
            otherTrckPct,
            focusTrckPct
          );
        }
      } else {
        const otherLap = getReferenceLap(otherCarIdx);

        const hasNoDataOrIsPit =
          isOnPitRoadFocus || isOnPitRoadOther || otherLap.finishTime <= 0;

        if (hasNoDataOrIsPit) {
          const focusEstTime = carIdxEstTime[focusIdx];
          const otherEstTime = carIdxEstTime[otherCarIdx];

          calculatedDelta = calculateClassEstimatedGap(
            getStats(focusEstTime, focusDriver), // Ahead
            getStats(otherEstTime, otherDriver), // Behind
            isTargetAhead
          );
        } else {
          calculatedDelta = calculateReferenceDelta(
            otherLap,
            otherTrckPct,
            focusTrckPct
          );
        }
      }

      return calculatedDelta;
    },
    [
      carIdxEstTime,
      carIdxIsOnPitRoad,
      carIdxLapDistPct,
      driverMap,
      focusCarIdx,
      getReferenceLap,
    ]
  );

  const standings = useMemo(() => {
    let sortedDrivers = drivers.filter(
      (driver) =>
        (driver.onTrack || driver.carIdx === focusCarIdx) &&
        driver.carIdx > -1 &&
        driver.carIdx !== paceCarIdx
    );

    sortedDrivers.forEach((d) =>
      collectLapData(d.carIdx, carIdxLapDistPct[d.carIdx], sessionTime)
    );

    sortedDrivers = sortedDrivers
      .map((result) => {
        const relativePct = calculateRelativePct(result.carIdx);
        const delta = calculateDelta(result.carIdx);
        return {
          ...result,
          relativePct,
          delta,
        };
      })
      .filter((result) => !isNaN(result.relativePct) && !isNaN(result.delta));

    const playerArrIndex = sortedDrivers.findIndex(
      (result) => result.carIdx === focusCarIdx
    );

    // if the player is not in the list, return an empty array
    if (playerArrIndex === -1) {
      return [];
    }

    const player = sortedDrivers[playerArrIndex];

    const driversAhead = sortedDrivers
      .filter((d) => d.relativePct > 0)
      .sort((a, b) => a.relativePct - b.relativePct) // sort ascending (closest to player first)
      .slice(0, buffer)
      .reverse(); // reverse to get furthest to closest for display

    const driversBehind = sortedDrivers
      .filter((d) => d.relativePct < 0)
      .sort((a, b) => b.relativePct - a.relativePct) // sort descending (closest to player first)
      .slice(0, buffer);

    return [...driversAhead, player, ...driversBehind];
  }, [
    drivers,
    buffer,
    focusCarIdx,
    paceCarIdx,
    collectLapData,
    carIdxLapDistPct,
    sessionTime,
    calculateRelativePct,
    calculateDelta,
  ]);

  return standings;
};
