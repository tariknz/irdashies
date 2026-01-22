import { useMemo, useState } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
  useTelemetryValue,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';
import { normalizeKey, useReferenceRegistry } from './useReferenceRegistry';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const driversGrouped = useDriverStandings();
  const drivers = driversGrouped as Standings[];
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

  const standings = useMemo(() => {
    const calculateRelativePct = (carIdx: number) => {
      if (focusCarIdx === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct?.[focusCarIdx];
      const otherDistPct = carIdxLapDistPct?.[carIdx];

      if (playerDistPct === undefined || otherDistPct === undefined) {
        return NaN;
      }

      const relativePct = otherDistPct - playerDistPct;

      if (relativePct > 0.5) {
        return relativePct - 1.0;
      } else if (relativePct < -0.5) {
        return relativePct + 1.0;
      }

      return relativePct;
    };

    const calculateDelta = (otherCarIdx: number) => {
      const activeIdx = focusCarIdx ?? 0;

      if (activeIdx === otherCarIdx) {
        return 0;
      }

      const isOnPitRoadFocus = carIdxIsOnPitRoad[activeIdx];
      const isOnPitRoadOther = carIdxIsOnPitRoad[otherCarIdx];

      const otherCarRefs = getReferenceLap(otherCarIdx) ?? new Map();
      const activeCarRefs = getReferenceLap(activeIdx) ?? new Map();

      const otherCarTrckPct = carIdxLapDistPct[otherCarIdx];
      const activeCarTrckPct = carIdxLapDistPct[activeIdx];

      let calculatedDelta = 0;

      // NOTE: focus is behind
      // TODO: finish line crossing need fixing
      if (activeCarTrckPct < otherCarTrckPct) {
        const closestPointActiveCar = normalizeKey(activeCarTrckPct);
        const timeAtLastPointOther = otherCarRefs.get(closestPointActiveCar);

        // TODO: check if crossing finish line while other car is in pits before finish line is a problem
        if (isOnPitRoadFocus || isOnPitRoadOther || !timeAtLastPointOther) {
          const estTimeActive = carIdxEstTime[activeIdx];
          const estTimeOther = carIdxEstTime[otherCarIdx];

          calculatedDelta = estTimeOther - estTimeActive;
        } else {
          calculatedDelta = sessionTime - timeAtLastPointOther;
        }
      } else {
        const closestPointOtherCar = normalizeKey(otherCarTrckPct);
        const timeAtLastPoint = activeCarRefs.get(closestPointOtherCar);

        if (isOnPitRoadFocus || isOnPitRoadOther || !timeAtLastPoint) {
          const estTimeActive = carIdxEstTime[activeIdx];
          const estTimeOther = carIdxEstTime[otherCarIdx];

          calculatedDelta = estTimeActive - estTimeOther;
        } else {
          calculatedDelta = timeAtLastPoint - sessionTime;
        }
      }

      const timeOfSample = timeOfSampling.get(otherCarIdx) ?? 0;

      if (sessionTime - timeOfSample > 0.085) {
        setLastDeltas((d) => {
          const newLastDelta = new Map(d);
          let deltas = (newLastDelta.get(otherCarIdx) as number[]) ?? [];
          if (deltas.length > 4) {
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
      const deltas =
        (lastDeltas.get(otherCarIdx) as number[]) ?? ([] as number[]);

      return deltas.reduce((acc, value) => (acc += value), 0) / 5;
    };

    const sortedDrivers = drivers
      .filter(
        (driver) =>
          (driver.onTrack || driver.carIdx === focusCarIdx) &&
          driver.carIdx > -1 &&
          driver.carIdx !== paceCarIdx
      )
      .map((result) => {
        const relativePct = calculateRelativePct(result.carIdx);
        collectLapData(
          result.carIdx,
          carIdxLapDistPct[result.carIdx],
          sessionTime
        );
        return {
          ...result,
          relativePct,
          delta: calculateDelta(result.carIdx),
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
    carIdxLapDistPct,
    carIdxIsOnPitRoad,
    getReferenceLap,
    sessionTime,
    timeOfSampling,
    lastDeltas,
    carIdxEstTime,
    paceCarIdx,
    collectLapData,
  ]);

  return standings;
};
