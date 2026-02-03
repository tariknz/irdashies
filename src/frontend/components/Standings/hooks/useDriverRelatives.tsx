import { useCallback, useEffect, useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
  useTelemetryValue,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import { useReferenceRegistry } from './useReferenceRegistry';
import {
  calculateClassEstimatedGap,
  calculateReferenceDelta,
  getStats,
} from '../relativeGapHelpers';
import { Standings } from '../createStandings';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxIsOnPitRoad = useTelemetryValues('CarIdxOnPitRoad');
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface');
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
    (opponentIdx: number) => {
      if (focusCarIdx === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct[focusCarIdx];
      const opponentDistPct = carIdxLapDistPct[opponentIdx];

      const relativePct = opponentDistPct - playerDistPct;

      if (relativePct > 0.5) {
        return relativePct - 1.0;
      } else if (relativePct < -0.5) {
        return relativePct + 1.0;
      }

      return relativePct;
    },
    [focusCarIdx, carIdxLapDistPct]
  );

  const calculateDelta = useCallback(
    (opponentCarIdx: number, relativeDistPct: number) => {
      const focusIdx = focusCarIdx ?? 0;

      if (focusIdx === opponentCarIdx) {
        return 0;
      }

      const isTargetAhead = relativeDistPct > 0 && relativeDistPct <= 0.5;

      const aheadIdx = isTargetAhead ? opponentCarIdx : focusIdx;
      const behindIdx = !isTargetAhead ? opponentCarIdx : focusIdx;

      const isOnPitRoadAhead = carIdxIsOnPitRoad[aheadIdx] === 1;
      const isOnPitRoadBehind = carIdxIsOnPitRoad[behindIdx] === 1;
      const isAnyoneOnPitRoad = isOnPitRoadAhead || isOnPitRoadBehind;

      const refLap = getReferenceLap(behindIdx);

      const isInPitOrHasNoData = isAnyoneOnPitRoad || refLap.finishTime <= 0;

      let calculatedDelta = 0;

      if (isInPitOrHasNoData) {
        const aheadEstTime = carIdxEstTime[aheadIdx];
        const aheadDriver = driverMap.get(aheadIdx);

        const behindEstTime = carIdxEstTime[behindIdx];
        const behindDriver = driverMap.get(behindIdx);

        calculatedDelta = calculateClassEstimatedGap(
          getStats(aheadEstTime, aheadDriver),
          getStats(behindEstTime, behindDriver),
          isTargetAhead
        );
      } else {
        const focusTrckPct = carIdxLapDistPct[focusIdx];
        const opponentTrckPct = carIdxLapDistPct[opponentCarIdx];

        calculatedDelta = calculateReferenceDelta(
          refLap,
          opponentTrckPct,
          focusTrckPct
        );
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

  const isValidDriver = useCallback(
    (driver: Standings) => {
      // Must be a real car (idx > -1)
      if (driver.carIdx <= -1) return false;

      // Must not be the pace car
      if (driver.carIdx === paceCarIdx) return false;

      // Must be on track OR be the player (we always track the player)
      return driver.onTrack || driver.carIdx === focusCarIdx;
    },
    [focusCarIdx, paceCarIdx]
  );

  // ===========================================================================
  // 1. DATA COLLECTION PHASE (Side Effect)
  // Run this in an Effect so it happens reliably after every frame update.
  // ===========================================================================
  useEffect(() => {
    drivers.forEach((d) => {
      if (isValidDriver(d)) {
        const idx = d.carIdx;
        collectLapData(
          idx,
          carIdxLapDistPct[idx],
          sessionTime,
          carIdxTrackSurface[idx],
          carIdxIsOnPitRoad[idx] === 1
        );
      }
    });
  }, [
    sessionTime,
    drivers,
    focusCarIdx,
    paceCarIdx,
    carIdxLapDistPct,
    carIdxTrackSurface,
    carIdxIsOnPitRoad,
    collectLapData,
    isValidDriver,
  ]);

  // ===========================================================================
  // 2. VIEW PROJECTION PHASE (Pure Calculation)
  // ===========================================================================
  const standings = useMemo(() => {
    // A. Filter & Map (Calculate Relative Pct immutably)
    const processed = drivers
      .filter(isValidDriver)
      .map((d) => ({
        ...d,
        relativePct: calculateRelativePct(d.carIdx),
      }))
      .filter((d) => !isNaN(d.relativePct));

    // B. Sort (Descending)
    processed.sort((a, b) => b.relativePct - a.relativePct);

    // C. Slice Window
    const playerIdx = processed.findIndex((d) => d.carIdx === focusCarIdx);
    if (playerIdx === -1) return [];

    const start = Math.max(0, playerIdx - buffer);
    const end = Math.min(processed.length, playerIdx + 1 + buffer);

    const visibleDrivers = processed.slice(start, end);

    // D. Final Map (Attach Delta)
    return visibleDrivers.map((d) => ({
      ...d,
      delta: calculateDelta(d.carIdx, d.relativePct),
    }));
  }, [
    drivers,
    isValidDriver,
    buffer,
    calculateRelativePct,
    focusCarIdx,
    calculateDelta,
  ]);

  return standings;
};
