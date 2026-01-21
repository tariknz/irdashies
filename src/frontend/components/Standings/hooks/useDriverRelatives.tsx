import { useMemo } from 'react';
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
  // CarIdxEstTime - iRacing's native estimated time gap calculation
  // const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const activeCarIdx = useFocusCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;
  const { processDriver, getReferenceLap } = useReferenceRegistry();
  const sessionTime = useTelemetryValue<number>('SessionTime') ?? 0;

  const standings = useMemo(() => {
    // const driversByCarIdx = new Map(
    //   drivers.map((driver) => [driver.carIdx, driver])
    // );

    // const interpolateTimeFromRef = (
    //   currTrackPct: number,
    //   refLap: ReferenceLap
    // ): number => {
    //   return 0;
    // };

    const calculateRelativePct = (carIdx: number) => {
      if (activeCarIdx === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct?.[activeCarIdx];
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
      const activeIdx = activeCarIdx ?? 0;

      const otherCarRefs = getReferenceLap(otherCarIdx) ?? new Map();
      const activeCarRefs = getReferenceLap(activeIdx) ?? new Map();

      const otherCarTrckPct = carIdxLapDistPct[otherCarIdx];
      const activeCarTrckPct = carIdxLapDistPct[activeIdx];

      // const closestPointActiveCar = findClosest(
      //   [...activeCarRefs.keys()],
      //   activeCarTrckPct
      // );
      // const closestPointOtherCar = findClosest(
      //   [...otherCarRefs.keys()],
      //   otherCarTrckPct
      // );
      const closestPointActiveCar = normalizeKey(activeCarTrckPct);

      // we are behind
      if (activeCarTrckPct < otherCarTrckPct) {
        const timeAtLastPointOther =
          otherCarRefs.get(closestPointActiveCar) ?? sessionTime;
        const timeAtLastPoint =
          activeCarRefs.get(closestPointActiveCar) ?? sessionTime;
        // console.log(`CarIdx: ${activeCarIdx}`);
        // console.log(`Time at last point: ${timeAtLastPoint}`);
        // console.log(`Session Time: ${sessionTime}`);

        return timeAtLastPoint - timeAtLastPointOther;
      }

      const closestPointOtherCar = normalizeKey(otherCarTrckPct);

      const timeAtLastPointOther =
        otherCarRefs.get(closestPointOtherCar) ?? sessionTime;
      const timeAtLastPoint =
        activeCarRefs.get(closestPointOtherCar) ?? sessionTime;
      // console.log(`CarIdx: ${otherCarIdx}`);
      // console.log(`Time at last point: ${timeAtLastPoint}`);
      // console.log(`Session Time: ${sessionTime}`);

      return timeAtLastPoint - timeAtLastPointOther;
    };

    const sortedDrivers = drivers
      .filter(
        (driver) =>
          (driver.onTrack || driver.carIdx === activeCarIdx) &&
          driver.carIdx > -1 &&
          driver.carIdx !== paceCarIdx
      )
      .map((result) => {
        const relativePct = calculateRelativePct(result.carIdx);
        processDriver(
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
      (result) => result.carIdx === activeCarIdx
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
    activeCarIdx,
    carIdxLapDistPct,
    getReferenceLap,
    sessionTime,
    paceCarIdx,
    processDriver,
  ]);

  return standings;
};
