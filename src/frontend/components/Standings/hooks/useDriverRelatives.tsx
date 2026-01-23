import { useCallback, useMemo, useState } from 'react';
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
  const [timeOfSampling, setTimeOfSampling] = useState(new Map());
  const [lastDeltas, setLastDeltas] = useState(new Map());

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

      const otherCarRefs = getReferenceLap(otherCarIdx) ?? new Map();
      const focusCarRefs = getReferenceLap(focusIdx) ?? new Map();

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
        const timeAtLastPointFocus = focusCarRefs.get(closestPointFocusCar);
        const timeAtLastPointOther = otherCarRefs.get(closestPointFocusCar);

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
          calculatedDelta = timeAtLastPointFocus - timeAtLastPointOther;
        }
      } else {
        const closestPointOtherCar = normalizeKey(otherCarTrckPct);
        const timeAtLastPointFocus = focusCarRefs.get(closestPointOtherCar);
        const timeAtLastPointOther = otherCarRefs.get(closestPointOtherCar);

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
          calculatedDelta = timeAtLastPointFocus - timeAtLastPointOther;
        }
      }

      const timeOfSample = timeOfSampling.get(otherCarIdx) ?? 0;

      if (sessionTime - timeOfSample > 0.035) {
        setLastDeltas((d) => {
          const newLastDelta = new Map(d);
          let deltas = (newLastDelta.get(otherCarIdx) as number[]) ?? [];
          if (deltas.length > 2) {
            deltas = deltas.slice(1);
          }
          deltas.push(calculatedDelta);
          newLastDelta.set(otherCarIdx, [...deltas]);

          return newLastDelta;
        });

        setTimeOfSampling((t) => {
          const newTimeOfSampling = new Map(t);
          newTimeOfSampling.set(otherCarIdx, sessionTime);

          return newTimeOfSampling;
        });
      }

      // TODO: Fix averages when big discrepancy
      const deltas = (lastDeltas.get(otherCarIdx) as number[]) ?? [];

      return (
        deltas.reduce((acc, value) => (acc += value), 0) /
        (deltas.length == 0 ? 1 : deltas.length)
      );
    },
    [
      calculateRelativeDist,
      carIdxEstTime,
      carIdxIsOnPitRoad,
      carIdxLapDistPct,
      driverMap,
      focusCarIdx,
      getReferenceLap,
      lastDeltas,
      sessionTime,
      timeOfSampling,
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
