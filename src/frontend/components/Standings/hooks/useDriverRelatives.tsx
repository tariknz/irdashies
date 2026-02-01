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

export const TRACK_SURFACES = {
  NotInWorld: -1,
  OffTrack: 0,
  InPitStall: 1,
  ApproachingPits: 2,
  OnTrack: 3,
};

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
    (carIdx: number) => {
      if (focusCarIdx === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct[focusCarIdx];
      const otherDistPct = carIdxLapDistPct[carIdx];

      return calculateRelativeDist(playerDistPct, otherDistPct);
    },
    [focusCarIdx, carIdxLapDistPct]
  );

  const calculateDelta = useCallback(
    (opponentCarIdx: number) => {
      const focusIdx = focusCarIdx ?? 0;

      if (focusIdx === opponentCarIdx) {
        return 0;
      }

      const focusTrckPct = carIdxLapDistPct[focusIdx];
      const opponentTrckPct = carIdxLapDistPct[opponentCarIdx];

      const relativeDistPct = calculateRelativeDist(
        focusTrckPct,
        opponentTrckPct
      );

      const isTargetAhead = relativeDistPct > 0 && relativeDistPct <= 0.5;

      const aheadIdx = isTargetAhead ? opponentCarIdx : focusIdx;
      const behindIdx = !isTargetAhead ? opponentCarIdx : focusIdx;

      const aheadDriver = driverMap.get(aheadIdx);
      const behindDriver = driverMap.get(behindIdx);

      const isOnPitRoadAhead = carIdxIsOnPitRoad[aheadIdx] === 1;
      const isOnPitRoadBehind = carIdxIsOnPitRoad[behindIdx] === 1;

      const refLap = getReferenceLap(behindIdx);

      const hasNoDataOrIsInPit =
        isOnPitRoadAhead || isOnPitRoadBehind || refLap.finishTime <= 0;

      let calculatedDelta = 0;

      if (hasNoDataOrIsInPit) {
        const aheadEstTime = carIdxEstTime[aheadIdx];
        const behindEstTime = carIdxEstTime[behindIdx];

        calculatedDelta = calculateClassEstimatedGap(
          getStats(aheadEstTime, aheadDriver),
          getStats(behindEstTime, behindDriver),
          isTargetAhead
        );
      } else {
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

  const standings = useMemo(() => {
    let sortedDrivers = drivers.filter(
      (driver) =>
        (driver.onTrack || driver.carIdx === focusCarIdx) &&
        driver.carIdx > -1 &&
        driver.carIdx !== paceCarIdx
    );

    sortedDrivers.forEach((d) =>
      collectLapData(
        d.carIdx,
        carIdxLapDistPct[d.carIdx],
        sessionTime,
        carIdxTrackSurface[d.carIdx],
        carIdxIsOnPitRoad[d.carIdx] === 1
      )
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
    carIdxTrackSurface,
    carIdxIsOnPitRoad,
    calculateRelativePct,
    calculateDelta,
  ]);

  return standings;
};
