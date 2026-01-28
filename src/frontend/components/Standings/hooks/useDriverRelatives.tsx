import { useCallback, useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
  useTelemetryValue,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import { normalizeKey, useReferenceRegistry } from './useReferenceRegistry';

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

  const calculateRelativeDist = useCallback(
    (focusDistPct: number, otherDistPct: number) => {
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
    },
    []
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
    [focusCarIdx, carIdxLapDistPct, calculateRelativeDist]
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

      const otherCarRefs = getReferenceLap(otherCarIdx);
      const focusCarRefs = getReferenceLap(focusIdx);

      const otherCarTrckPct = carIdxLapDistPct[otherCarIdx];
      const focusCarTrckPct = carIdxLapDistPct[focusIdx];

      let calculatedDelta = 0;
      const relativeDistPct = calculateRelativeDist(
        focusCarTrckPct,
        otherCarTrckPct
      );

      // NOTE: focus is behind
      if (relativeDistPct > 0 && relativeDistPct <= 0.5) {
        const closestPointFocusCar = normalizeKey(focusCarTrckPct);
        const closestPointOtherCar = normalizeKey(otherCarTrckPct);
        const timeAtLastPointFocus =
          focusCarRefs.refPoints.get(closestPointFocusCar);
        const timeAtLastPointOther =
          otherCarRefs.refPoints.get(closestPointOtherCar);

        // TODO: check if crossing finish line while other car is in pits before finish line is a problem
        // FIX: opponent sitting in pit lane calculation
        if (
          isOnPitRoadFocus ||
          isOnPitRoadOther ||
          !timeAtLastPointOther ||
          !timeAtLastPointFocus
        ) {
          const estTimeFocus = carIdxEstTime[focusIdx];
          const estTimeOther = carIdxEstTime[otherCarIdx];
          if (focusDriver?.carClass.id !== otherDriver?.carClass.id) {
            const focusClassEstTime = focusDriver?.carClass.estLapTime ?? 1;
            const otherClassEstTime = otherDriver?.carClass.estLapTime ?? 1;

            const estTimeScaled = Math.max(
              estTimeOther * (focusClassEstTime / otherClassEstTime),
              estTimeOther
            );

            calculatedDelta = estTimeScaled - estTimeFocus;
          } else {
            calculatedDelta = estTimeOther - estTimeFocus;
          }
        } else {
          calculatedDelta =
            timeAtLastPointFocus.timeElapsedSinceStart -
            timeAtLastPointOther.timeElapsedSinceStart;
        }
      } else {
        const closestPointFocusCar = normalizeKey(focusCarTrckPct);
        const closestPointOtherCar = normalizeKey(otherCarTrckPct);
        const timeAtLastPointFocus =
          focusCarRefs.refPoints.get(closestPointFocusCar);
        const timeAtLastPointOther =
          otherCarRefs.refPoints.get(closestPointOtherCar);

        if (
          isOnPitRoadFocus ||
          isOnPitRoadOther ||
          !timeAtLastPointFocus ||
          !timeAtLastPointOther
        ) {
          const estTimeFocus = carIdxEstTime[focusIdx];
          const estTimeOther = carIdxEstTime[otherCarIdx];
          if (focusDriver?.carClass.id !== otherDriver?.carClass.id) {
            const focusClassEstTime = focusDriver?.carClass.estLapTime ?? 1;
            const otherClassEstTime = otherDriver?.carClass.estLapTime ?? 1;

            const estTimeScaled = Math.min(
              estTimeFocus * (otherClassEstTime / focusClassEstTime),
              estTimeFocus
            );

            calculatedDelta = estTimeFocus - estTimeScaled;
          } else {
            calculatedDelta = estTimeOther - estTimeFocus;
          }
        } else {
          calculatedDelta =
            timeAtLastPointOther.timeElapsedSinceStart -
            timeAtLastPointFocus.timeElapsedSinceStart;
        }
      }

      return calculatedDelta;
    },
    [
      calculateRelativeDist,
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
