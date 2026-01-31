import { useCallback, useMemo } from 'react';
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
  calculateRelativeDist,
  getStats,
} from '../relativeGapHelpers';

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
